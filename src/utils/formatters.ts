export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const formatDateForDB = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatPercent = (rate: number): string => {
  return `${rate}%`;
};

export const formatClientName = (client: { name: string; country?: string }): string => {
  return client.country ? `${client.name} (${client.country})` : client.name;
};

export const formatProductName = (product: { name: string; default_price?: number }): string => {
  const price = product.default_price ? ` - ${formatCurrency(product.default_price)}` : '';
  return `${product.name}${price}`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};