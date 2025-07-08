import TelegramBot from 'node-telegram-bot-api';
import { InvoiceModel, InvoiceLineModel, ClientModel, UserModel, PaymentModel } from '../database/models-new';
import { clearConversationState, getConversationState } from '../bot';
import { formatDateForDB, addDays } from '../utils/formatters';
import { generatePDF } from '../pdf/generator';
import { uploadPDFToStorage } from '../utils/storage';
import path from 'path';
import fs from 'fs';

export const paymentHandlers = (bot: TelegramBot) => {
  bot.on('pre_checkout_query', (query) => {
    const payload = query.invoice_payload;
    
    if (!payload || (!payload.startsWith('temp_') && !payload.startsWith('regenerate_'))) {
      bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Invalid invoice data' });
      return;
    }
    
    bot.answerPreCheckoutQuery(query.id, true);
  });

  bot.on('successful_payment', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const payment = msg.successful_payment!;
    
    try {
      // Get invoice data from conversation state
      const state = getConversationState(userId);
      if (!state || !state.data.client_id || !state.data.lines) {
        bot.sendMessage(chatId, '❌ Error: Invoice data not found. Please try creating the invoice again.');
        return;
      }
      
      const clientId = state.data.client_id;
      const lines = state.data.lines;
      
      const user = await UserModel.findByTelegramId(userId);
      const client = await ClientModel.findById(clientId);
      
      if (!user || !client) {
        bot.sendMessage(chatId, '❌ Error processing payment: User or client not found');
        return;
      }
      
      const issueDate = new Date();
      const dueDate = addDays(issueDate, 30);
      const invoiceNumber = await InvoiceModel.generateInvoiceNumber();
      
      let subtotal = 0;
      let vatTotal = 0;
      let total = 0;
      
      lines.forEach((line: any) => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineVat = lineSubtotal * (line.vat_rate / 100);
        subtotal += lineSubtotal;
        vatTotal += lineVat;
        total += lineSubtotal + lineVat;
      });
      
      const invoiceData = {
        user_id: userId,
        invoice_number: invoiceNumber,
        client_id: clientId,
        issue_date: formatDateForDB(issueDate),
        due_date: formatDateForDB(dueDate),
        subtotal: subtotal,
        vat_total: vatTotal,
        total_amount: total,
        pdf_path: ''
      };
      
      const invoiceId = await InvoiceModel.create(invoiceData);
      
      for (const line of lines) {
        await InvoiceLineModel.create({
          invoice_id: invoiceId,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          vat_rate: line.vat_rate,
          line_total: line.line_total
        });
      }
      
      // Record the payment
      await PaymentModel.create({
        user_id: userId,
        invoice_id: invoiceId,
        telegram_payment_charge_id: payment.telegram_payment_charge_id,
        provider_payment_charge_id: payment.provider_payment_charge_id,
        amount: payment.total_amount,
        currency: payment.currency,
        payload: payment.invoice_payload,
        status: 'completed',
        refunded: false
      });
      
      // Create temporary PDF file
      const tempDir = './temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempPdfPath = path.join(tempDir, `invoice_${invoiceNumber}.pdf`);
      
      const invoice = await InvoiceModel.findById(invoiceId);
      const invoiceLines = await InvoiceLineModel.findByInvoiceId(invoiceId);
      
      if (invoice) {
        await generatePDF(user, client, invoice, invoiceLines, tempPdfPath);
        
        // Upload PDF to Supabase Storage
        const storagePath = await uploadPDFToStorage(tempPdfPath, `invoice_${invoiceNumber}.pdf`, invoiceId);
        
        // Update invoice with storage path
        await InvoiceModel.update(invoiceId, { pdf_path: storagePath });
        
        // Send PDF to user
        await bot.sendDocument(chatId, tempPdfPath, {
          caption: `✅ Invoice ${invoiceNumber} generated successfully!\n\nTotal: ${payment.total_amount} ${payment.currency}\nPayment ID: ${payment.telegram_payment_charge_id}\n\n📝 Save the Payment ID for potential refunds (use /refund [payment_id])`
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempPdfPath);
        
        clearConversationState(userId);
        
        bot.sendMessage(chatId, '🎉 Payment successful! Your invoice PDF has been generated and sent above.');
      } else {
        bot.sendMessage(chatId, '❌ Error generating invoice PDF. Please contact support.');
      }
      
    } catch (error) {
      console.error('Payment processing error:', error);
      bot.sendMessage(chatId, '❌ Error processing payment. Please try again or contact support.');
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const userId = query.from.id;
    const data = query.data!;
    
    if (data.startsWith('invoice_pay_')) {
      const invoiceId = parseInt(data.split('_')[2]);
      const invoice = await InvoiceModel.findById(invoiceId);
      
      if (!invoice || invoice.user_id !== userId) {
        bot.answerCallbackQuery(query.id, { text: 'Invoice not found or access denied' });
        return;
      }
      
      const starsPrice = parseInt(process.env.TELEGRAM_STARS_PRICE || '25');
      
      const payloadData = `regenerate_${invoiceId}_${Date.now()}`;
      
      // Send invoice for Telegram Stars payment
      await bot.sendInvoice(
        chatId,
        'Regenerate Invoice PDF',
        `Regenerate PDF for invoice ${invoice.invoice_number}`,
        payloadData,
        '',
        'XTR',
        [{ label: 'PDF Regeneration', amount: starsPrice }]
      );
      
      bot.editMessageText(`💰 **Regenerate Invoice PDF**\n\nInvoice: ${invoice.invoice_number}\nTotal: ${invoice.total_amount} EUR\n\nI've sent you an invoice for ${starsPrice} Stars to regenerate the PDF.`, {
        chat_id: chatId,
        message_id: query.message!.message_id
      });
    }
    
    bot.answerCallbackQuery(query.id);
  });

  // Note: This pre_checkout_query handler is already defined above, so we remove this duplicate

  // Handle regeneration payments
  bot.on('successful_payment', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const payment = msg.successful_payment!;
    
    try {
      const payload = payment.invoice_payload;
      
      // Check if this is a regeneration payment
      if (payload.startsWith('regenerate_')) {
        const parts = payload.split('_');
        const invoiceId = parseInt(parts[1]);
        const invoice = await InvoiceModel.findById(invoiceId);
        
        if (!invoice || invoice.user_id !== userId) {
          bot.sendMessage(chatId, '❌ Error: Invoice not found or access denied');
          return;
        }
        
        const user = await UserModel.findByTelegramId(userId);
        const client = await ClientModel.findById(invoice.client_id);
        const invoiceLines = await InvoiceLineModel.findByInvoiceId(invoiceId);
        
        if (!user || !client) {
          bot.sendMessage(chatId, '❌ Error: User or client data not found');
          return;
        }
        
        // Create temporary PDF file
        const tempDir = './temp';
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempPdfPath = path.join(tempDir, `invoice_${invoice.invoice_number}.pdf`);
        
        await generatePDF(user, client, invoice, invoiceLines, tempPdfPath);
        
        // Upload PDF to Supabase Storage
        const storagePath = await uploadPDFToStorage(tempPdfPath, `invoice_${invoice.invoice_number}.pdf`, invoiceId);
        
        // Update invoice with storage path
        await InvoiceModel.update(invoiceId, { pdf_path: storagePath });
        
        await bot.sendDocument(chatId, tempPdfPath, {
          caption: `✅ Invoice ${invoice.invoice_number} regenerated successfully!\n\nPayment ID: ${payment.telegram_payment_charge_id}\n\n📝 Save the Payment ID for potential refunds (use /refund [payment_id])`
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempPdfPath);
        
        // Record the regeneration payment
        await PaymentModel.create({
          user_id: userId,
          invoice_id: invoiceId,
          telegram_payment_charge_id: payment.telegram_payment_charge_id,
          provider_payment_charge_id: payment.provider_payment_charge_id,
          amount: payment.total_amount,
          currency: payment.currency,
          payload: payload,
          status: 'completed',
          refunded: false
        });
        
        bot.sendMessage(chatId, '🎉 Payment successful! Your invoice PDF has been regenerated and sent above.');
        return;
      }
      
      // This is handled by the first successful_payment handler above
      
    } catch (error) {
      console.error('Payment processing error:', error);
      bot.sendMessage(chatId, '❌ Error processing payment. Please try again or contact support.');
    }
  });
};