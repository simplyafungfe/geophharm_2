// Legacy database utilities - now using MySQL
// This file is kept for backward compatibility
// New database operations should use the models in /models/ directory

console.warn('⚠️  Legacy database utilities loaded. New MySQL models available in /models/ directory.');

// Simplified compatibility layer - most functions now throw deprecation errors
const createUser = async (userData) => {
  throw new Error('createUser deprecated. Use User.create() from /models/User.js instead.');
};

const getUserByEmail = async (email) => {
  throw new Error('getUserByEmail deprecated. Use User.findByEmail() from /models/User.js instead.');
};

const getUserById = async (id) => {
  throw new Error('getUserById deprecated. Use User.findById() from /models/User.js instead.');
};

const updateUser = async (id, updateData) => {
  throw new Error('updateUser deprecated. Use User.update() from /models/User.js instead.');
};

const createPharmacy = async (pharmacyData) => {
  throw new Error('createPharmacy deprecated. Use Pharmacy.create() from /models/Pharmacy.js instead.');
};

const getPharmacyById = async (id) => {
  throw new Error('getPharmacyById deprecated. Use Pharmacy.findById() from /models/Pharmacy.js instead.');
};

const getPharmaciesByUserId = async (userId) => {
  throw new Error('getPharmaciesByUserId deprecated. Use Pharmacy.findAll() from /models/Pharmacy.js instead.');
};

const getNearbyPharmacies = async (lat, lng, radius = 10) => {
  throw new Error('getNearbyPharmacies deprecated. Use Pharmacy.findAll() with location filter from /models/Pharmacy.js instead.');
};

const getAllDrugs = async () => {
  throw new Error('getAllDrugs deprecated. Use Drug.findAll() from /models/Drug.js instead.');
};

const searchDrugs = async (searchTerm) => {
  throw new Error('searchDrugs deprecated. Use Drug.search() from /models/Drug.js instead.');
};

const addToInventory = async (inventoryData) => {
  throw new Error('addToInventory deprecated. Use Drug.create() from /models/Drug.js instead.');
};

const updateInventory = async (id, updateData) => {
  throw new Error('updateInventory deprecated. Use Drug.update() from /models/Drug.js instead.');
};

const getPharmacyInventory = async (pharmacyId) => {
  throw new Error('getPharmacyInventory deprecated. Use Drug.findByPharmacy() from /models/Drug.js instead.');
};

const searchDrugsInPharmacies = async (drugName, lat, lng, radius = 10) => {
  throw new Error('searchDrugsInPharmacies deprecated. Use Drug.search() from /models/Drug.js instead.');
};

// Export all functions for backward compatibility
module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  createPharmacy,
  getPharmacyById,
  getPharmaciesByUserId,
  getNearbyPharmacies,
  getAllDrugs,
  searchDrugs,
  addToInventory,
  updateInventory,
  getPharmacyInventory,
  searchDrugsInPharmacies
};
