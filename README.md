# Telegram Invoice Generator Bot

A complete Telegram bot for generating professional invoice PDFs with Telegram Stars monetization system.

## Features

- 🏢 Company profile setup and management
- 👥 Client management (add, edit, delete clients)
- 📦 Product/service catalog management
- 📄 Interactive invoice creation workflow
- 💰 Telegram Stars payment integration
- 📋 Professional PDF invoice generation
- 📊 Invoice history and regeneration
- 🔄 Refund system with 24-hour window
- 🛠️ Payment support system

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your environment:**
   - Copy `.env.example` to `.env`
   - Add your Telegram bot token (get from @BotFather)
   - Configure other settings as needed

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Bot Commands

### Setup Commands
- `/start` - Welcome message and initial setup
- `/setup` - Configure company information
- `/profile` - View current company settings

### Client Management
- `/clients` - List all clients
- `/addclient` - Add new client
- `/editclient` - Edit existing client
- `/deleteclient` - Remove client

### Product Management
- `/products` - List all products/services
- `/addproduct` - Add new product/service
- `/editproduct` - Edit existing product
- `/deleteproduct` - Remove product

### Invoice Management
- `/newinvoice` - Create new invoice
- `/invoices` - View recent invoices
- `/invoice [number]` - Regenerate specific invoice PDF

### Payment & Support
- `/paysupport` - Get payment support and refund info
- `/refund [payment_id]` - Request refund for a payment

### General
- `/help` - Show help message
- `/cancel` - Cancel current operation

## Configuration

### Environment Variables

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `DATABASE_PATH` - Path to SQLite database file
- `PDF_STORAGE_PATH` - Directory for storing generated PDFs
- `TELEGRAM_STARS_PRICE` - Price in Telegram Stars for PDF generation

### Database

The bot uses SQLite for data storage with the following tables:
- `users` - Company/user profiles
- `clients` - Client information
- `products` - Product/service catalog
- `invoices` - Invoice records
- `invoice_lines` - Invoice line items
- `payments` - Payment records

## PDF Generation

The bot generates professional invoices with:
- Company header and branding
- Client information
- Itemized invoice lines
- VAT calculations and breakdowns
- Bank details
- Professional formatting

## Payment Integration

- PDF generation requires payment in Telegram Stars (25 Stars = $0.325)
- Secure payment processing through Telegram's system
- Payment verification before PDF generation
- Support for invoice regeneration
- **Monetization Note**: Stars earned by bots can be used for Telegram Ads or withdrawn to TON (withdrawal feature coming soon, requires 1000+ Stars and 21-day waiting period)
- Refund system available within 24 hours of payment

### Payment Tracking
- All payments are tracked in database
- Payment IDs provided for refund requests
- Refund status monitoring
- Payment history per user

## Development

### Project Structure

```
src/
├── bot.ts              # Main bot setup
├── database/
│   ├── db.ts          # Database connection
│   └── models.ts      # Database models
├── handlers/
│   ├── setup.ts       # Company setup
│   ├── clients.ts     # Client management
│   ├── products.ts    # Product management
│   ├── invoices.ts    # Invoice creation
│   └── payments.ts    # Payment handling
├── pdf/
│   └── generator.ts   # PDF generation
├── utils/
│   ├── validators.ts  # Input validation
│   └── formatters.ts  # Formatting utilities
└── types.ts           # TypeScript interfaces
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Support

For issues and feature requests, please create an issue in the repository.

## License

This project is licensed under the MIT License.