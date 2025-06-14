// Shared validation helpers
const ValidationHelpers = {
  isIndonesianPhone: (phone) => {
    const cleanPhone = phone.replace(/\s|-/g, '');
    const phoneRegex = /^(\+62|62|0)[0-9]{8,13}$/;
    return phoneRegex.test(cleanPhone);
  },

  isIndonesianIdCard: (idCard) => {
    const cleanIdCard = idCard.replace(/\s|-/g, '');
    return /^[0-9]{16}$/.test(cleanIdCard);
  },

  formatCurrency: (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  },

  formatPhone: (phone) => {
    const cleanPhone = phone.replace(/\s|-/g, '');
    if (cleanPhone.startsWith('62')) {
      return '+' + cleanPhone;
    } else if (cleanPhone.startsWith('0')) {
      return '+62' + cleanPhone.substring(1);
    }
    return cleanPhone;
  }
};

module.exports = ValidationHelpers;