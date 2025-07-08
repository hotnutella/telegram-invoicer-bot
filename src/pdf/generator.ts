import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import { User, Client, Invoice, InvoiceLine } from '../types';
import { formatDate } from '../utils/formatters';

const alignRight = (x: number, text: string, fieldWidth: number, font: any, size = 12) => {
  const width = font.widthOfTextAtSize(text, size);
  return x + fieldWidth - width;
};

const formatDateForPDF = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
};

const formatAddress = (address: string, city: string, zipCode: string) => {
  return `${address}, ${zipCode} ${city}`;
};

export async function generatePDF(
  user: User,
  client: Client,
  invoice: Invoice,
  lines: InvoiceLine[],
  outputPath: string
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const top = height - 50;
  const bottom = 80;
  const left = 50;
  const right = width - 50;
  const lineThickness = 0.75;
  const defaultFieldWidth = 60;
  const mediumFieldWidth = 100;
  const largeFieldWidth = 180;

  const companyName = user.company_name || 'Company Name';
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let x = left;
  let y = top;
  let txt = companyName;
  
  // Company header
  page.drawText(txt, {
    x,
    y,
    size: 24,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  // Client block
  y -= 30;
  txt = 'Client:';
  page.drawText(txt, {
    x: left,
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 15;
  txt = client.name || '';
  page.drawText(txt, {
    x: left,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  if (client.address_line1) {
    y -= 15;
    txt = client.address_line1;
    page.drawText(txt, {
      x: left,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  if (client.address_line2) {
    y -= 15;
    txt = client.address_line2;
    page.drawText(txt, {
      x: left,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  if (client.country) {
    y -= 15;
    txt = client.country;
    page.drawText(txt, {
      x: left,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  if (client.reg_number) {
    y -= 15;
    txt = `Reg number: ${client.reg_number}`;
    page.drawText(txt, {
      x: left,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  if (client.vat_number) {
    y -= 15;
    txt = `VAT number: ${client.vat_number}`;
    page.drawText(txt, {
      x: left,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  // Invoice block
  y = top - 30;
  x = right - 2 * mediumFieldWidth;
  txt = 'Invoice nr:';
  page.drawText(txt, {
    x,
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  txt = invoice.invoice_number;
  x += mediumFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, mediumFieldWidth, helveticaBold, 14),
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  y -= 20;
  x = right - 2 * mediumFieldWidth;
  txt = 'Date:';
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  txt = formatDateForPDF(invoice.issue_date);
  x += mediumFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, mediumFieldWidth, helvetica),
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 20;
  x = right - 2 * mediumFieldWidth;
  txt = 'Terms:';
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  // Calculate days between issue and due date
  const days = Math.floor((new Date(invoice.due_date).getTime() - new Date(invoice.issue_date).getTime()) / (1000 * 60 * 60 * 24));
  txt = `${days} days`;
  x += mediumFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, mediumFieldWidth, helvetica),
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 20;
  x = right - 2 * mediumFieldWidth;
  txt = 'Due date:';
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  txt = formatDateForPDF(invoice.due_date);
  x += mediumFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, mediumFieldWidth, helveticaBold),
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  y -= 20;
  x = right - 2 * mediumFieldWidth;
  txt = 'Penalty:';
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  txt = '0.05% per day';
  x += mediumFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, mediumFieldWidth, helvetica),
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  // Bank block
  y -= 30;
  x = right - 2 * mediumFieldWidth;
  txt = user.bank_name || 'Bank Name';
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  y -= 15;
  txt = `IBAN: ${user.iban || ''}`;
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 15;
  txt = `SWIFT: ${user.swift || ''}`;
  page.drawText(txt, {
    x,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y = top - 220;
  
  // Line titles
  txt = 'Description';
  page.drawText(txt, {
    x: left,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  txt = 'Price';
  x = right - 4 * defaultFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, defaultFieldWidth, helveticaBold),
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  txt = 'Quantity';
  x += defaultFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, defaultFieldWidth, helveticaBold),
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  txt = 'VAT';
  x += defaultFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, defaultFieldWidth, helveticaBold),
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  txt = 'Total';
  x += defaultFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, defaultFieldWidth, helveticaBold),
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  // Header line
  page.drawLine({
    start: { x: left, y: top - 225 },
    end: { x: right, y: top - 225 },
    thickness: lineThickness,
    color: rgb(0, 0, 0)
  });

  // Invoice lines
  for (const [i, line] of Object.entries(lines)) {
    y = top - 240 - Number(i) * 20;

    txt = line.description;
    page.drawText(txt, {
      x: left,
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    txt = line.unit_price.toFixed(2);
    x = right - 4 * defaultFieldWidth;
    page.drawText(txt, {
      x: alignRight(x, txt, defaultFieldWidth, helvetica),
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    txt = `${line.quantity}`;
    x += defaultFieldWidth;
    page.drawText(txt, {
      x: alignRight(x, txt, defaultFieldWidth, helvetica),
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    txt = `${line.vat_rate}%`;
    x += defaultFieldWidth;
    page.drawText(txt, {
      x: alignRight(x, txt, defaultFieldWidth, helvetica),
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    txt = (line.quantity * line.unit_price).toFixed(2);
    x += defaultFieldWidth;
    page.drawText(txt, {
      x: alignRight(x, txt, defaultFieldWidth, helvetica),
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  // Bottom line
  page.drawLine({
    start: { x: left, y: top - 225 - lines.length * 20 },
    end: { x: right, y: top - 225 - lines.length * 20 },
    thickness: lineThickness,
    color: rgb(0, 0, 0)
  });

  // Totals section
  txt = 'Subtotal without VAT';
  x = right - defaultFieldWidth - largeFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, largeFieldWidth, helvetica),
    y: top - 225 - (lines.length + 2) * 20,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  const totalWithoutVat = lines.reduce((acc, line) => acc + line.quantity * line.unit_price, 0);
  txt = totalWithoutVat.toFixed(2);
  x += largeFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, defaultFieldWidth, helvetica),
    y: top - 225 - (lines.length + 2) * 20,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  // VAT breakdown
  const distinctVats = Array.from(new Set(lines.map((line) => line.vat_rate)));
  for (const [i, vat] of Object.entries(distinctVats)) {
    txt = `Value added tax ${vat}%`;
    x = right - defaultFieldWidth - largeFieldWidth;
    page.drawText(txt, {
      x: alignRight(x, txt, largeFieldWidth, helvetica),
      y: top - 225 - (lines.length + 3 + Number(i)) * 20,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    const vatTotal = lines.reduce((acc, line) => {
      if (line.vat_rate === vat) {
        return acc + line.quantity * line.unit_price * line.vat_rate / 100;
      }
      return acc;
    }, 0);
    txt = vatTotal.toFixed(2);
    x += largeFieldWidth;
    page.drawText(txt, {
      x: alignRight(x, txt, defaultFieldWidth, helvetica),
      y: top - 225 - (lines.length + 3 + Number(i)) * 20,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  // Total amount
  txt = 'Total to pay (EUR)';
  x = right - defaultFieldWidth - largeFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, largeFieldWidth, helveticaBold, 14),
    y: top - 225 - (lines.length + 3 + distinctVats.length) * 20,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  const totalAmount = invoice.total_amount;
  txt = totalAmount.toFixed(2);
  x += largeFieldWidth;
  page.drawText(txt, {
    x: alignRight(x, txt, defaultFieldWidth, helveticaBold, 14),
    y: top - 225 - (lines.length + 3 + distinctVats.length) * 20,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  // Payment instruction
  txt = 'PLEASE PROVIDE INVOICE NUMBER IN PAYMENT DETAILS';
  page.drawText(txt, {
    x: left,
    y: top - 225 - (lines.length + 3 + distinctVats.length + 3) * 20,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  // Footer line
  page.drawLine({
    start: { x: left, y: bottom },
    end: { x: right, y: bottom },
    thickness: lineThickness,
    color: rgb(0, 0, 0)
  });

  // Company block in footer
  y = bottom - 12;
  txt = companyName;
  page.drawText(txt, {
    x: left,
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 12;
  txt = formatAddress(user.address || '', user.city || '', user.zip_code || '');
  page.drawText(txt, {
    x: left,
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 12;
  txt = `Reg number: ${user.reg_number || ''}`;
  page.drawText(txt, {
    x: left,
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 12;
  txt = `VAT number: ${user.vat_number || ''}`;
  page.drawText(txt, {
    x: left,
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  // Contact block in footer
  y = bottom - 12;
  x = right - largeFieldWidth;
  txt = `E-mail: ${user.email || ''}`;
  page.drawText(txt, {
    x: alignRight(x, txt, largeFieldWidth, helvetica, 10),
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  y -= 12;
  txt = `Phone: ${user.phone || ''}`;
  page.drawText(txt, {
    x: alignRight(x, txt, largeFieldWidth, helvetica, 10),
    y,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0)
  });

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}