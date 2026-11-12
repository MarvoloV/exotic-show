declare module "qrcode" {
  export function toBuffer(text: string, options: {
    type: "png";
    errorCorrectionLevel: "M";
    margin: number;
    width: number;
  }): Promise<Buffer>;
}
