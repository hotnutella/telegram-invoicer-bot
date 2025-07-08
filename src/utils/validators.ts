export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
};

export const validateIBAN = (iban: string): boolean => {
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
  return ibanRegex.test(iban.replace(/\s/g, ''));
};

export const validateVATNumber = (vat: string): boolean => {
  return vat.length >= 8 && vat.length <= 15;
};

export const validateNumber = (value: string): boolean => {
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
};

export const validatePositiveNumber = (value: string): boolean => {
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num) && num > 0;
};

export const validateVATRate = (rate: string): boolean => {
  const num = parseInt(rate);
  return !isNaN(num) && num >= 0 && num <= 100;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validateRequired = (value: string): boolean => {
  return Boolean(value && value.trim().length > 0);
};