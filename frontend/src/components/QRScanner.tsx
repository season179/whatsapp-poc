import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRScannerProps {
  qr: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ qr }) => (
  <div style={{ textAlign: 'center', marginTop: 20 }}>
    <h2>Scan the QR Code</h2>
    <QRCodeSVG value={qr} size={256} />
  </div>
);

export default QRScanner;
