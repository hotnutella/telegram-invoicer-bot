import TelegramBot from 'node-telegram-bot-api';
import { InvoiceModel, InvoiceLineModel, ClientModel, ProductModel, UserModel } from '../database/models-new';
import { getConversationState, setConversationState, clearConversationState } from '../bot';
import { sanitizeInput, validateRequired, validatePositiveNumber, validateVATRate } from '../utils/validators';
import { formatCurrency, formatDate, formatDateForDB, addDays, truncateText, formatClientName, formatProductName } from '../utils/formatters';
import { InvoiceCreationState, VATBreakdown } from '../types';

export const invoiceHandlers = (bot: TelegramBot) => {
  bot.onText(/\/newinvoice/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const user = UserModel.findByTelegramId(userId);
    if (!user || !user.company_name) {
      bot.sendMessage(chatId, '⚠️ Please set up your company information first using /setup');
      return;
    }
    
    const clients = ClientModel.findByUserId(userId);
    if (clients.length === 0) {
      bot.sendMessage(chatId, '⚠️ You need to add at least one client first. Use /addclient to add a client.');
      return;
    }
    
    const keyboard = clients.map((client) => [{
      text: truncateText(formatClientName(client), 30),
      callback_data: `invoice_select_client_${client.id}`
    }]);
    
    keyboard.push([{ text: '➕ Add New Client', callback_data: 'invoice_add_client' }]);
    
    setConversationState(userId, {
      step: 'invoice_select_client',
      data: { lines: [] }
    });
    
    bot.sendMessage(chatId, '📄 **Creating New Invoice**\n\nSelect a client:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.onText(/\/invoices/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const invoices = InvoiceModel.findByUserId(userId, 10);
    
    if (invoices.length === 0) {
      bot.sendMessage(chatId, '📄 No invoices found. Use /newinvoice to create your first invoice.');
      return;
    }
    
    let message = '📄 **Recent Invoices:**\n\n';
    
    for (const invoice of invoices) {
      const client = ClientModel.findById(invoice.client_id);
      const clientName = client ? client.name : 'Unknown Client';
      
      message += `**${invoice.invoice_number}** - ${clientName}\n`;
      message += `Date: ${formatDate(new Date(invoice.issue_date))}\n`;
      message += `Amount: ${formatCurrency(invoice.total_amount)}\n\n`;
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/invoice (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const invoiceNumber = match![1];
    
    const invoice = InvoiceModel.findByNumber(invoiceNumber);
    
    if (!invoice || invoice.user_id !== userId) {
      bot.sendMessage(chatId, '❌ Invoice not found or you don\'t have permission to access it.');
      return;
    }
    
    const keyboard = [[
      { text: '💰 Pay & Generate PDF', callback_data: `invoice_pay_${invoice.id}` }
    ]];
    
    bot.sendMessage(chatId, `📄 Invoice ${invoice.invoice_number} found!\n\nTotal: ${formatCurrency(invoice.total_amount)}\n\nPay ${process.env.TELEGRAM_STARS_PRICE || 25} Stars to regenerate the PDF.`, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const userId = query.from.id;
    const data = query.data!;
    
    if (data.startsWith('invoice_')) {
      const parts = data.split('_');
      
      switch (parts[1]) {
        case 'select':
          if (parts[2] === 'client') {
            const clientId = parseInt(parts[3]);
            const client = ClientModel.findById(clientId);
            
            if (client) {
              const state = getConversationState(userId);
              if (state) {
                state.data.client_id = clientId;
                setConversationState(userId, state);
                
                const products = ProductModel.findByUserId(userId);
                const keyboard = products.map((product) => [{
                  text: truncateText(formatProductName(product), 30),
                  callback_data: `invoice_select_product_${product.id}`
                }]);
                
                keyboard.push([{ text: '✏️ Custom Item', callback_data: 'invoice_custom_item' }]);
                keyboard.push([{ text: '📊 Review Invoice', callback_data: 'invoice_review' }]);
                
                bot.editMessageText(`📄 **Invoice for:** ${client.name}\n\nSelect a product/service or add a custom item:`, {
                  chat_id: chatId,
                  message_id: query.message!.message_id,
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: keyboard
                  }
                });
              }
            }
            break;
        }
        
        case 'add':
          if (parts[2] === 'client') {
            setConversationState(userId, {
              step: 'client_add_name',
              data: { return_to_invoice: true }
            });
            
            bot.sendMessage(chatId, '👤 Adding new client for invoice.\n\nPlease enter the client name:');
          }
          break;
          
        case 'select':
          if (parts[2] === 'product') {
            const productId = parseInt(parts[3]);
            const product = ProductModel.findById(productId);
            
            if (product) {
              const state = getConversationState(userId);
              if (state) {
                state.data.current_line = {
                  description: product.name,
                  unit_price: product.default_price || 0,
                  vat_rate: product.default_vat_rate || 0,
                  quantity: 1
                };
                state.step = 'invoice_add_quantity';
                setConversationState(userId, state);
                
                bot.sendMessage(chatId, `📦 Adding: ${product.name}\n\nEnter quantity (default: 1):`);
              }
            }
          }
          break;
          
        case 'custom':
          if (parts[2] === 'item') {
            const state = getConversationState(userId);
            if (state) {
              state.data.current_line = {};
              state.step = 'invoice_add_description';
              setConversationState(userId, state);
              
              bot.sendMessage(chatId, '✏️ Adding custom item.\n\nEnter item description:');
            }
          }
          break;
          
        case 'review':
          const state = getConversationState(userId);
          if (state && state.data.client_id) {
            const client = ClientModel.findById(state.data.client_id);
            const lines = state.data.lines || [];
            
            if (lines.length === 0) {
              bot.sendMessage(chatId, '⚠️ No items added to invoice. Please add at least one item.');
              return;
            }
            
            const { subtotal, vatBreakdown, total } = calculateInvoiceTotals(lines);
            
            let reviewMessage = `📄 **Invoice Review**\n\n`;
            reviewMessage += `**Client:** ${client?.name}\n\n`;
            reviewMessage += `**Items:**\n`;
            
            lines.forEach((line: any, index: number) => {
              reviewMessage += `${index + 1}. ${line.description}\n`;
              reviewMessage += `   ${line.quantity} × ${formatCurrency(line.unit_price)} (${line.vat_rate}% VAT)\n`;
              reviewMessage += `   Total: ${formatCurrency(line.line_total)}\n\n`;
            });
            
            reviewMessage += `**Subtotal:** ${formatCurrency(subtotal)}\n`;
            
            if (vatBreakdown.length > 0) {
              reviewMessage += `**VAT:**\n`;
              vatBreakdown.forEach(vat => {
                reviewMessage += `   ${vat.rate}%: ${formatCurrency(vat.vat_amount)}\n`;
              });
            }
            
            reviewMessage += `**Total:** ${formatCurrency(total)}\n\n`;
            reviewMessage += `💰 Pay ${process.env.TELEGRAM_STARS_PRICE || 25} Stars to generate PDF`;
            
            const keyboard = [
              [{ text: '➕ Add More Items', callback_data: 'invoice_add_more' }],
              [{ text: '💰 Pay & Generate PDF', callback_data: 'invoice_generate_pdf' }],
              [{ text: '❌ Cancel', callback_data: 'invoice_cancel' }]
            ];
            
            bot.editMessageText(reviewMessage, {
              chat_id: chatId,
              message_id: query.message!.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
          break;
          
        case 'add':
          if (parts[2] === 'more') {
            const products = ProductModel.findByUserId(userId);
            const keyboard = products.map((product) => [{
              text: truncateText(formatProductName(product), 30),
              callback_data: `invoice_select_product_${product.id}`
            }]);
            
            keyboard.push([{ text: '✏️ Custom Item', callback_data: 'invoice_custom_item' }]);
            keyboard.push([{ text: '📊 Review Invoice', callback_data: 'invoice_review' }]);
            
            bot.editMessageText('📦 **Add More Items**\n\nSelect a product/service or add a custom item:', {
              chat_id: chatId,
              message_id: query.message!.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
          break;
          
        case 'generate':
          if (parts[2] === 'pdf') {
            const state = getConversationState(userId);
            if (state && state.data.client_id && state.data.lines) {
              const starsPrice = parseInt(process.env.TELEGRAM_STARS_PRICE || '25');
              
              // Store invoice data temporarily and use simple payload
              const tempInvoiceId = `temp_${userId}_${Date.now()}`;
              setConversationState(userId, {
                ...state,
                temp_invoice_id: tempInvoiceId
              });
              
              const invoicePayload = tempInvoiceId;
              
              // Send invoice for Telegram Stars payment
              await bot.sendInvoice(
                chatId,
                'Invoice PDF Generation',
                'Generate professional invoice PDF',
                invoicePayload,
                '', // provider_token not needed for Stars
                'XTR',
                [{ label: 'PDF Generation', amount: starsPrice }]
              );
              
              bot.editMessageText(`💰 **Payment Required**\n\nI've sent you an invoice for ${starsPrice} Telegram Stars to generate your PDF.`, {
                chat_id: chatId,
                message_id: query.message!.message_id
              });
            }
          }
          break;
          
        case 'cancel':
          clearConversationState(userId);
          bot.editMessageText('❌ Invoice creation cancelled.', {
            chat_id: chatId,
            message_id: query.message!.message_id
          });
          break;
      }
    }
    
    bot.answerCallbackQuery(query.id);
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const state = getConversationState(userId);
    if (!state || !state.step.startsWith('invoice_')) return;
    
    const sanitizedText = sanitizeInput(text);
    
    switch (state.step) {
      case 'invoice_add_description':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Description is required. Please enter item description:');
          return;
        }
        
        state.data.current_line.description = sanitizedText;
        state.step = 'invoice_add_quantity';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🔢 Enter quantity:');
        break;
        
      case 'invoice_add_quantity':
        if (!validatePositiveNumber(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Invalid quantity. Please enter a positive number:');
          return;
        }
        
        state.data.current_line.quantity = parseFloat(sanitizedText);
        state.step = 'invoice_add_unit_price';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '💰 Enter unit price:');
        break;
        
      case 'invoice_add_unit_price':
        if (!validatePositiveNumber(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Invalid price. Please enter a positive number:');
          return;
        }
        
        state.data.current_line.unit_price = parseFloat(sanitizedText);
        state.step = 'invoice_add_vat_rate';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📊 Enter VAT rate (0-100):');
        break;
        
      case 'invoice_add_vat_rate':
        if (!validateVATRate(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Invalid VAT rate. Please enter a number between 0 and 100:');
          return;
        }
        
        state.data.current_line.vat_rate = parseInt(sanitizedText);
        
        const line = state.data.current_line;
        const lineTotal = line.quantity * line.unit_price;
        const vatAmount = lineTotal * (line.vat_rate / 100);
        line.line_total = lineTotal + vatAmount;
        
        state.data.lines.push(line);
        state.data.current_line = {};
        state.step = 'invoice_item_added';
        setConversationState(userId, state);
        
        const keyboard = [
          [{ text: '➕ Add More Items', callback_data: 'invoice_add_more' }],
          [{ text: '📊 Review Invoice', callback_data: 'invoice_review' }]
        ];
        
        bot.sendMessage(chatId, `✅ Item added: ${line.description}\nQuantity: ${line.quantity} × ${formatCurrency(line.unit_price)} = ${formatCurrency(line.line_total)}\n\nWhat would you like to do next?`, {
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
        break;
    }
  });
};

function calculateInvoiceTotals(lines: any[]): { subtotal: number, vatBreakdown: VATBreakdown[], total: number } {
  let subtotal = 0;
  const vatRates = new Map<number, number>();
  
  lines.forEach(line => {
    const lineSubtotal = line.quantity * line.unit_price;
    subtotal += lineSubtotal;
    
    const vatAmount = lineSubtotal * (line.vat_rate / 100);
    const currentVat = vatRates.get(line.vat_rate) || 0;
    vatRates.set(line.vat_rate, currentVat + vatAmount);
  });
  
  const vatBreakdown: VATBreakdown[] = [];
  let totalVat = 0;
  
  vatRates.forEach((amount, rate) => {
    if (rate > 0) {
      vatBreakdown.push({
        rate,
        amount: subtotal * (rate / 100), // This should be calculated per rate group
        vat_amount: amount
      });
      totalVat += amount;
    }
  });
  
  return {
    subtotal,
    vatBreakdown,
    total: subtotal + totalVat
  };
}