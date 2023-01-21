import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { PaymentChannel } from '../typechain-types/contracts/PaymentChannel';

// import web3 from 'web3';

let shh: any;

const sign = async (
  channel: PaymentChannel,
  signer: Signer,
  id: string,
  recipient: string,
  value: string
) => {
  const hash = await channel.getHash(id, recipient, value);
  let sig = await signer.signMessage(hash);
  sig = sig.substr(2, sig.length);

  return {
    r: '0x' + sig.substr(0, 64),
    s: '0x' + sig.substr(64, 64),
    v: Number(sig.substr(128, 2)) + 27,
  };
};

export default class PaymentChannelJS {
  account: Signer;
  recipient?: string;
  me: string;
  them: string;
  role: 'beneficiary' | 'payer';
  numPays: number;
  channelId?: number;
  payment: any;

  payer = 'payer';
  beneficiary = 'beneficiary';
  name = 'PaymentChannel_tIh9ChHhuBAXz3';

  timeout?: NodeJS.Timeout;

  lastPayment: any;

  contract?: PaymentChannel;

  constructor(opts: any) {
    // if( opts.role !== PaymentChannel.payer && opts.role !== PaymentChannel.beneficiary ) {
    //     throw "PaymentChannel requires role to be set to either 'beneficiary' or 'payer'";
    // }
    this.account = opts.account;
    this.recipient = undefined;
    this.me = opts.me;
    this.them = opts.them;
    this.role = opts.role;
    this.numPays = 0;
    this.channelId = undefined;
    this.payment = opts.payment;
    if (this.payment === undefined) this.payment = {};

    // this.contract = ethers.getContractAt('PaymentChannel', '0x0');
  }

  start() {
    if (this.role === 'beneficiary') this.setupBeneficiary();
    else this.setupPayer();
  }

  onPayload(payload: any) {
    console.log('onPayload not set');
    return false;
  }

  data() {
    console.log('data not set');
    return false;
  }

  onPayment(error: Error | undefined, payment: any) {
    console.log('onPayment not set');
    return false;
  }

  getData() {
    if (typeof this.data === 'function') return this.data();
    else if (typeof this.data === 'object') return JSON.stringify(this.data);
    // else if (typeof this.data === 'string') return web3.toHex(this.data); // todo
    else return this.data;
  }

  async paymentFilter(err: Error, res: any) {
    var payment = JSON.parse(web3.toAscii(res.payload));

    var error: Error | undefined = undefined;

    if (
      await !this.contract?.verify(
        this.channelId,
        this.account,
        payment.value,
        payment.sig.v,
        payment.sig.r,
        payment.sig.s
      )
    ) {
      error = new Error('Payment received invalid');
    } else if (
      (await this.contract?.getChannelValue(this.channelId)) < payment.value
    ) {
      error = new Error('Channel has insufficient funds');
    } else if (this.lastPayment) {
      var last = this.lastPayment;

      var lastv = new BigNumber(last.value);
      const newv = new BigNumber(payment.value);

      if (lastv.gte(newv)) {
        error = new Error('Last payment greater or equal to current');
      } else if (
        newv.sub(lastv).lt(new BigNumber(paymentChannel.payment.inc))
      ) {
        error = new Error(
          'Increment too low (' +
            payment.value +
            ' - ' +
            last.value +
            ' < ' +
            this.payment.inc
        );
      }
    } else {
      if (payment.value < this.payment.base) {
        error = new Error('Base payment is too low');
      }
    }
    this.lastPayment = payment;

    if (this.onPayment(error, payment)) {
      this.post();
    }
  }

  readyFilter(res: any) {
    this.channelId = res.payload;

    shh.filter(
      {
        to: this.me,
        from: this.them,
        topics: [PaymentChannelJS.name, this.channelId, 'payment'],
      },
      this.paymentFilter
    );
    this.post();
  }

  setupBeneficiary() {
    shh.post({
      topics: [PaymentChannelJS.name, 'setup'],
      from: this.me,
      to: this.them,
      payload: this.account,
    });

    var paymentChannel = this;

    // paymentChannel.readyFilter = shh.filter(
    //   {
    //     from: paymentChannel.them,
    //     to: paymentChannel.me,
    //     topics: [PaymentChannelJS.name, 'ready'],
    //   },
    //   function (err, res) {

    //   }
    // );
  }

  post() {
    var payload = this.getData();
    if (payload === false) {
      shh.post({
        from: this.me,
        to: this.them,
        topics: [PaymentChannelJS.name, this.channelId, 'done'],
      });
      return;
    } else {
      shh.post({
        from: this.me,
        to: this.them,
        topics: [PaymentChannelJS.name, this.channelId, 'deliver'],
        payload: payload,
      });
    }
  }

  async negotiateFilter(res: any) {
    this.recipient = res.payload;
    // setup new channel
    const newChannelFilter = this.contract?.NewChannel(
      { owner: this.account },
      (e: Error, ev) => {
        // set the payment channel id
        this.channelId = ev.args.channel;

        // let the other side know we're ready for receiving content
        shh.post({
          from: this.me,
          to: this.them,
          topics: [PaymentChannelJS.name, 'ready'],
          payload: ev.args.channel,
        });

        // create whisper channel
        this.createChannel(ev.args.channel);
      }
    );

    // create channel on ethereum network
    await this.contract?.createChannel({
      from: await this.account.getAddress(),
      value: this.payment.value,
      gas: 1000000,
    });
  }

  deliveryFilter(error: Error, res: any) {
    // clear previous timeout
    if (this.timeout) clearTimeout(this.timeout);

    if (!this.onPayload(res.payload)) {
      this.cancel();
      return;
    }

    var p = this.payment;

    var value = p.base + p.inc * this.numPays;

    if (!this.contract) return;

    // create transaction for the payment channel
    var payment = JSON.stringify({
      sig: sign(
        this.contract,
        this.account,
        this.channelId,
        this.recipient,
        value
      ),
      value: value,
    });

    // broadcast payment to recipient
    shh.post({
      from: this.me,
      to: this.them,
      topics: [PaymentChannelJS.name, this.channelId, 'payment'],
      // payload: web3.toHex(payment),
    });
    this.numPays++;

    // update timeout handler
    this.timeout = this.createTimeout();
  }

  createTimeout() {
    return setTimeout(() => {
      this.cancel();
    }, 2000);
  }

  setupPayer() {
    var paymentChannel = this;

    paymentChannel.negotiateFilter = shh.filter(
      {
        from: paymentChannel.them,
        to: paymentChannel.me,
        topics: [PaymentChannelJS.name, 'setup'],
      },
      function (error, res) {}
    );
  }

  createChannel(channelName: string) {
    var paymentChannel = this;

    // timeout variable for timing out payments
    let timeout;

    // delivery channel
    paymentChannel.deliveryFilter = shh.filter(
      {
        from: paymentChannel.them,
        to: paymentChannel.me,
        topics: [PaymentChannelJS.name, channelName, 'deliver'],
      },
      function (error, res) {}
    );
  }

  redeem() {
    var last = this.lastPayment;

    console.log('redeeming payment');
    inspect(last);

    try {
      channel.claim(
        this.channelId,
        this.account,
        last.value,
        last.sig.v,
        last.sig.r,
        last.sig.s,
        { from: this.account, gas: 1000000 }
      );
    } catch (e) {
      console.log(e);
    }
  }

  cancel() {
    if (this.negotiateFilter) this.negotiateFilter.stopWatching();
    if (this.deliveryFilter) this.deliveryFilter.stopWatching();
    if (this.newChannelFilter) this.newChannelFilter.stopWatching();
    if (this.paymentFilter) this.paymentFilter.stopWatching();
    if (this.readyFilter) this.readyFilter.stopWatching();
  }
}
