/* PCM capture only. This processor never sends audio to a network endpoint. */
class MicCheckCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.buffer = new Float32Array(2048);
    this.offset = 0;
    this.port.onmessage = ({data}) => {
      if (data === 'start') { this.offset = 0; this.active = true; }
      if (data === 'stop') {
        this.active = false;
        this.flush();
        this.port.postMessage({done: true});
      }
    };
  }
  flush() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    this.port.postMessage({samples}, [samples.buffer]);
    this.offset = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (this.active && channels?.length) {
      for (let i = 0; i < channels[0].length; i++) {
        let sum = 0;
        for (const channel of channels) sum += channel[i];
        this.buffer[this.offset++] = sum / channels.length;
        if (this.offset === this.buffer.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('miccheck-capture', MicCheckCapture);
