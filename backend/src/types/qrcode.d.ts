// qrcode.d.ts ambient module types
declare module 'qrcode' {
  export interface ToStringOptions {
    type?: 'terminal';
    small?: boolean;
  }

  export function toString(text: string, options?: ToStringOptions): Promise<string>;

  const qrcode: {
    toString(text: string, options?: ToStringOptions): Promise<string>;
  };

  export default qrcode;
}
