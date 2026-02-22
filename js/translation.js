const { en } = require('./lang/en.js')
const { fr } = require('./lang/fr.js')
const { zh } = require('./lang/zh.js')
const { hi } = require('./lang/hi.js')

const translation = (key, language, ...args) => {
  const data = {
    en: { ...en },
    fr: { ...fr },
    zh: { ...zh },
    hi: { ...hi },
  }
  const lang = language ? data[language] ? language : 'en' : 'en';
  // Helper function to resolve nested keys safely
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj)
  }

  const value = getNestedValue(data[lang], key)

  // If the value is a function, call it with the provided arguments
  if (typeof value === 'function') {
    return value(...args)
  }

  // Return the value if found, or fallback to the key
  return value !== undefined ? value : key
}

module.exports = {
  translation,
}
