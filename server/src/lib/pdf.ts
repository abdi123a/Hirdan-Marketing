import PDFDocument from 'pdfkit';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  amount: number;
  taxRate?: number | null;
  discount?: number | null;
  discountType?: string | null;
  deposit?: number | null;
  items: InvoiceItem[];
}

interface ClientData {
  name: string;
  company: string;
  email: string | null;
  address?: string | null;
}

interface AgencySettings {
  agencyName?: string | null;
  primaryColor?: string | null;
  website?: string | null;
  address?: string | null;
  phone?: string | null;
  adminEmail?: string | null;
  currency?: string | null;
}

export function generateInvoicePdf(
  invoice: InvoiceData,
  client: ClientData,
  settings: AgencySettings | null,
  monthPaid: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const agencyName = settings?.agencyName || 'Hirdan Marketing';
    const primaryColor = settings?.primaryColor || '#504289';
    const accentColor = '#f6b317';
    const currencySymbol = settings?.currency || 'USD';
    const website = settings?.website || 'hirdanmarketing.com';

    // Helper: format currency
    const formatPrice = (cents: number) => {
      return `${currencySymbol} ${(cents / 100).toFixed(2)}`;
    };

    // Helper: format date
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    // Draw Top Branded Color Bar
    const docWidth = doc.page.width;
    doc.rect(0, 0, docWidth * 0.7, 10).fill(primaryColor);
    doc.rect(docWidth * 0.7, 0, docWidth * 0.3, 10).fill(accentColor);

    // Header Content
    doc.y = 35;
    
    // Agency Name (Left)
    doc.fillColor(primaryColor)
       .fontSize(22)
       .font('Helvetica-Bold')
       .text(agencyName, 50, doc.y);

    // Document Title (Right)
    doc.fillColor('#0f172a')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('PAYMENT RECEIPT', docWidth - 250, 35, { width: 200, align: 'right' });

    // Spacer
    doc.moveDown(2);

    // Metadata & Bill To columns
    const metadataY = doc.y;

    // Left Column: Bill To
    doc.fontSize(10)
       .fillColor('#64748b')
       .font('Helvetica-Bold')
       .text('BILL TO', 50, metadataY);
    
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .text(client.name, 50, doc.y + 5);
    
    doc.font('Helvetica')
       .text(client.company, 50, doc.y + 3);

    if (client.address) {
      doc.text(client.address, 50, doc.y + 3, { width: 220 });
    }
    if (client.email) {
      doc.text(client.email, 50, doc.y + 3);
    }

    // Right Column: Invoice / Payment Info
    const rightColX = docWidth - 250;
    doc.fontSize(10)
       .fillColor('#64748b')
       .font('Helvetica-Bold')
       .text('RECEIPT DETAILS', rightColX, metadataY);

    let infoY = doc.y + 5;
    const addInfoRow = (label: string, value: string, isHighlighted = false) => {
      doc.fontSize(9)
         .fillColor('#64748b')
         .font('Helvetica')
         .text(label, rightColX, infoY);
      
      doc.fillColor(isHighlighted ? '#10b981' : '#0f172a')
         .font(isHighlighted ? 'Helvetica-Bold' : 'Helvetica')
         .text(value, rightColX + 90, infoY, { width: 110, align: 'right' });
      
      infoY += 14;
    };

    addInfoRow('Invoice Number:', invoice.invoiceNumber);
    addInfoRow('Invoice Date:', formatDate(invoice.date));
    addInfoRow('Due Date:', formatDate(invoice.dueDate));
    addInfoRow('Month Paid:', monthPaid, true);
    addInfoRow('Payment Status:', 'PAID', true);

    // Adjust Y position after the column info
    doc.y = Math.max(doc.y, infoY) + 30;

    // Line Items Table
    doc.fontSize(10)
       .fillColor('#64748b')
       .font('Helvetica-Bold');

    // Table Headers
    const descX = 50;
    const qtyX = docWidth - 220;
    const priceX = docWidth - 150;
    const totalX = docWidth - 50;

    doc.text('Description', descX, doc.y);
    doc.text('Qty', qtyX, doc.y, { width: 40, align: 'center' });
    doc.text('Unit Price', priceX, doc.y, { width: 60, align: 'right' });
    doc.text('Total', totalX - 60, doc.y, { width: 60, align: 'right' });

    // Table Header Border
    doc.moveTo(50, doc.y + 12)
       .lineTo(docWidth - 50, doc.y + 12)
       .lineWidth(1)
       .strokeColor('#cbd5e1')
       .stroke();

    doc.y += 18;

    // Table Rows
    doc.font('Helvetica').fillColor('#334155');
    let itemsSubtotal = 0;

    invoice.items.forEach((item) => {
      const itemTotal = item.quantity * item.unitPrice;
      itemsSubtotal += itemTotal;

      // Wrap description text if too long
      const descHeight = doc.heightOfString(item.description, { width: qtyX - descX - 10 });
      const rowY = doc.y;

      doc.text(item.description, descX, rowY, { width: qtyX - descX - 10 });
      doc.text(item.quantity.toString(), qtyX, rowY, { width: 40, align: 'center' });
      doc.text(formatPrice(item.unitPrice), priceX, rowY, { width: 60, align: 'right' });
      doc.text(formatPrice(itemTotal), totalX - 60, rowY, { width: 60, align: 'right' });

      doc.y = rowY + Math.max(descHeight, 15) + 8;

      // Row Border
      doc.moveTo(50, doc.y - 4)
         .lineTo(docWidth - 50, doc.y - 4)
         .lineWidth(0.5)
         .strokeColor('#f1f5f9')
         .stroke();
    });

    doc.y += 10;

    // Totals calculations matching computeInvoiceTotal
    let calculatedTotal = itemsSubtotal;
    let discountAmount = 0;

    if (invoice.discount != null && invoice.discountType) {
      if (invoice.discountType === 'FIXED') {
        discountAmount = invoice.discount;
      } else {
        discountAmount = Math.round(calculatedTotal * (invoice.discount / 100));
      }
      calculatedTotal -= discountAmount;
    }

    let taxAmount = 0;
    if (invoice.taxRate != null) {
      taxAmount = Math.round(calculatedTotal * (invoice.taxRate / 100));
      calculatedTotal += taxAmount;
    }

    if (calculatedTotal < 0) calculatedTotal = 0;

    // Totals Summary Box
    const totalsX = docWidth - 250;
    let totalsY = doc.y;

    const addTotalRow = (label: string, valStr: string, isBold = false) => {
      doc.fontSize(9)
         .fillColor(isBold ? '#0f172a' : '#64748b')
         .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
         .text(label, totalsX, totalsY);
      
      doc.fontSize(isBold ? 11 : 9)
         .fillColor(isBold ? '#10b981' : '#334155')
         .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
         .text(valStr, totalX - 100, totalsY, { width: 100, align: 'right' });
      
      totalsY += 15;
    };

    addTotalRow('Subtotal:', formatPrice(itemsSubtotal));
    
    if (discountAmount > 0) {
      addTotalRow('Discount:', `-${formatPrice(discountAmount)}`);
    }
    
    if (taxAmount > 0) {
      addTotalRow(`Tax (${invoice.taxRate}%):`, formatPrice(taxAmount));
    }

    addTotalRow('Total Paid:', formatPrice(calculatedTotal), true);

    doc.y = totalsY + 40;

    // Signature and Stamp placeholders
    const sigY = doc.y;
    doc.moveTo(50, sigY + 40)
       .lineTo(200, sigY + 40)
       .lineWidth(0.5)
       .strokeColor('#cbd5e1')
       .stroke();
    
    doc.fontSize(8)
       .fillColor('#64748b')
       .font('Helvetica')
       .text('Authorized Signature', 50, sigY + 45);

    // Footer Block
    doc.y = doc.page.height - 100;

    doc.moveTo(50, doc.y)
       .lineTo(docWidth - 50, doc.y)
       .lineWidth(0.5)
       .strokeColor('#e2e8f0')
       .stroke();

    doc.y += 15;

    doc.fontSize(8)
       .fillColor('#94a3b8')
       .font('Helvetica-Oblique')
       .text("Empowering your brand's future through strategic digital growth", 50, doc.y, { align: 'center' });

    doc.moveDown(1);

    doc.fontSize(8)
       .fillColor('#64748b')
       .font('Helvetica-Bold')
       .text(agencyName, 50, doc.y, { align: 'center' });

    let footerContact = website;
    if (settings?.phone) footerContact += `  |  ${settings.phone}`;
    if (settings?.adminEmail) footerContact += `  |  ${settings.adminEmail}`;

    doc.fontSize(8)
       .fillColor('#94a3b8')
       .font('Helvetica')
       .text(footerContact, 50, doc.y + 10, { align: 'center' });

    doc.end();
  });
}
