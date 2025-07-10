import TelegramBot from 'node-telegram-bot-api';
import { ProductModel } from '../database/models';
import { Product } from '../types';
import { getConversationState, setConversationState, clearConversationState } from '../bot';
import { sanitizeInput, validateRequired, validatePositiveNumber, validateVATRate } from '../utils/validators';
import { formatProductName, formatCurrency, truncateText } from '../utils/formatters';

export const productHandlers = (bot: TelegramBot) => {
  bot.onText(/\/products/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const products = await ProductModel.findByUserId(userId);
    
    if (products.length === 0) {
      bot.sendMessage(chatId, '📦 No products/services found. Use /addproduct to add your first product.');
      return;
    }
    
    const keyboard = products.map((product: Product) => [{
      text: truncateText(formatProductName(product), 30),
      callback_data: `product_view_${product.id}`
    }]);
    
    keyboard.push([{ text: '➕ Add New Product', callback_data: 'product_add' }]);
    
    bot.sendMessage(chatId, '📦 **Your Products/Services:**', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.onText(/\/addproduct/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    setConversationState(userId, {
      step: 'product_add_name',
      data: {}
    });
    
    bot.sendMessage(chatId, '📦 Adding new product/service.\n\nPlease enter the product/service name:');
  });

  bot.onText(/\/editproduct/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const products = await ProductModel.findByUserId(userId);
    
    if (products.length === 0) {
      bot.sendMessage(chatId, '📦 No products/services found. Use /addproduct to add your first product.');
      return;
    }
    
    const keyboard = products.map((product: Product) => [{
      text: truncateText(formatProductName(product), 30),
      callback_data: `product_edit_${product.id}`
    }]);
    
    bot.sendMessage(chatId, '✏️ **Select product to edit:**', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.onText(/\/deleteproduct/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const products = await ProductModel.findByUserId(userId);
    
    if (products.length === 0) {
      bot.sendMessage(chatId, '📦 No products/services found.');
      return;
    }
    
    const keyboard = products.map((product: Product) => [{
      text: truncateText(formatProductName(product), 30),
      callback_data: `product_delete_${product.id}`
    }]);
    
    bot.sendMessage(chatId, '🗑️ **Select product to delete:**', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const userId = query.from.id;
    const data = query.data!;
    
    if (data.startsWith('product_')) {
      const [action, operation, id] = data.split('_');
      
      switch (operation) {
        case 'view':
          const product = await ProductModel.findById(parseInt(id));
          if (product) {
            const productInfo = `📦 **Product/Service Information:**

**Name:** ${product.name}
**Description:** ${product.description || 'Not set'}
**Default Price:** ${product.default_price ? formatCurrency(product.default_price) : 'Not set'}
**Default VAT Rate:** ${product.default_vat_rate !== undefined ? `${product.default_vat_rate}%` : 'Not set'}`;

            const keyboard = [
              [{ text: '✏️ Edit', callback_data: `product_edit_${product.id}` }],
              [{ text: '🗑️ Delete', callback_data: `product_delete_${product.id}` }],
              [{ text: '🔙 Back to Products', callback_data: 'products_list' }]
            ];

            bot.editMessageText(productInfo, {
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
          setConversationState(userId, {
            step: 'product_add_name',
            data: {}
          });
          
          bot.sendMessage(chatId, '📦 Adding new product/service.\n\nPlease enter the product/service name:');
          break;
          
        case 'edit':
          const editProduct = await ProductModel.findById(parseInt(id));
          if (editProduct) {
            setConversationState(userId, {
              step: 'product_edit_name',
              data: { product_id: editProduct.id, ...editProduct }
            });
            
            bot.sendMessage(chatId, `✏️ Editing product: ${editProduct.name}\n\nEnter new name (current: ${editProduct.name}) or type "skip" to keep current:`);
          }
          break;
          
        case 'delete':
          const deleteProduct = await ProductModel.findById(parseInt(id));
          if (deleteProduct) {
            const keyboard = [
              [{ text: '✅ Yes, Delete', callback_data: `product_confirm_delete_${id}` }],
              [{ text: '❌ Cancel', callback_data: 'products_list' }]
            ];

            bot.editMessageText(`🗑️ Are you sure you want to delete product "${deleteProduct.name}"?`, {
              chat_id: chatId,
              message_id: query.message!.message_id,
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
          break;
          
        case 'confirm':
          if (data.includes('delete')) {
            const deleteId = parseInt(data.split('_')[3]);
            await ProductModel.delete(deleteId);
            
            bot.editMessageText('✅ Product deleted successfully!', {
              chat_id: chatId,
              message_id: query.message!.message_id
            });
          }
          break;
      }
      
      if (data === 'products_list') {
        const products = await ProductModel.findByUserId(userId);
        
        if (products.length === 0) {
          bot.editMessageText('📦 No products/services found. Use /addproduct to add your first product.', {
            chat_id: chatId,
            message_id: query.message!.message_id
          });
          return;
        }
        
        const keyboard = products.map((product: Product) => [{
          text: truncateText(formatProductName(product), 30),
          callback_data: `product_view_${product.id}`
        }]);
        
        keyboard.push([{ text: '➕ Add New Product', callback_data: 'product_add' }]);
        
        bot.editMessageText('📦 **Your Products/Services:**', {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
    }
    
    bot.answerCallbackQuery(query.id);
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const state = getConversationState(userId);
    if (!state || !state.step.startsWith('product_')) return;
    
    const sanitizedText = sanitizeInput(text);
    
    switch (state.step) {
      case 'product_add_name':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Product name is required. Please enter a valid product name:');
          return;
        }
        
        state.data.name = sanitizedText;
        state.step = 'product_add_description';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📝 Enter product description (or type "skip" to skip):');
        break;
        
      case 'product_add_description':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.description = sanitizedText;
        }
        
        state.step = 'product_add_price';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '💰 Enter default price (or type "skip" to skip):');
        break;
        
      case 'product_add_price':
        if (sanitizedText.toLowerCase() !== 'skip') {
          if (!validatePositiveNumber(sanitizedText)) {
            bot.sendMessage(chatId, '❌ Invalid price format. Please enter a valid price (e.g., 99.99):');
            return;
          }
          state.data.default_price = parseFloat(sanitizedText);
        }
        
        state.step = 'product_add_vat_rate';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📊 Enter default VAT rate (0-100) or type "skip" to skip:');
        break;
        
      case 'product_add_vat_rate':
        if (sanitizedText.toLowerCase() !== 'skip') {
          if (!validateVATRate(sanitizedText)) {
            bot.sendMessage(chatId, '❌ Invalid VAT rate. Please enter a number between 0 and 100:');
            return;
          }
          state.data.default_vat_rate = parseInt(sanitizedText);
        }
        
        const productData = {
          user_id: userId,
          name: state.data.name,
          description: state.data.description,
          default_price: state.data.default_price,
          default_vat_rate: state.data.default_vat_rate
        };
        
        await ProductModel.create(productData);
        clearConversationState(userId);
        
        bot.sendMessage(chatId, '✅ Product added successfully!');
        break;
        
      case 'product_edit_name':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.name = sanitizedText;
        }
        
        state.step = 'product_edit_description';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `📝 Enter description (current: ${state.data.description || 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'product_edit_description':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.description = sanitizedText;
        }
        
        state.step = 'product_edit_price';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `💰 Enter default price (current: ${state.data.default_price ? formatCurrency(state.data.default_price) : 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'product_edit_price':
        if (sanitizedText.toLowerCase() !== 'skip') {
          if (!validatePositiveNumber(sanitizedText)) {
            bot.sendMessage(chatId, '❌ Invalid price format. Please enter a valid price (e.g., 99.99):');
            return;
          }
          state.data.default_price = parseFloat(sanitizedText);
        }
        
        state.step = 'product_edit_vat_rate';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `📊 Enter default VAT rate (current: ${state.data.default_vat_rate !== undefined ? `${state.data.default_vat_rate}%` : 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'product_edit_vat_rate':
        if (sanitizedText.toLowerCase() !== 'skip') {
          if (!validateVATRate(sanitizedText)) {
            bot.sendMessage(chatId, '❌ Invalid VAT rate. Please enter a number between 0 and 100:');
            return;
          }
          state.data.default_vat_rate = parseInt(sanitizedText);
        }
        
        const updateData = {
          name: state.data.name,
          description: state.data.description,
          default_price: state.data.default_price,
          default_vat_rate: state.data.default_vat_rate
        };
        
        await ProductModel.update(state.data.product_id, updateData);
        clearConversationState(userId);
        
        bot.sendMessage(chatId, '✅ Product updated successfully!');
        break;
    }
  });
};