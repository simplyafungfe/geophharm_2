// Pharmacy Data Management Module
class PharmacyDataManager {
    constructor() {
        this.pharmacies = [];
        this.loadPharmacyData();
    }

    async loadPharmacyData() {
        try {
            const response = await fetch('/data/pharmacies.json');
            const data = await response.json();
            this.pharmacies = data.pharmacies;
            console.log('Pharmacy data loaded successfully:', this.pharmacies.length, 'pharmacies');
        } catch (error) {
            console.error('Error loading pharmacy data:', error);
            // Fallback to sample data if JSON file fails to load
            this.loadFallbackData();
        }
    }

    loadFallbackData() {
        this.pharmacies = [
            {
                id: "ph001",
                name: "Central Pharmacy Bamenda",
                address: "Commercial Avenue, Bamenda",
                phone: "+237 233 362 145",
                coordinates: { latitude: 5.9597, longitude: 10.1460 },
                inventory: [
                    {
                        drugId: "drug001",
                        name: "Paracetamol 500mg",
                        category: "Pain Relief",
                        price: 2500,
                        currency: "XAF",
                        stock: 150
                    }
                ]
            }
        ];
    }

    // Search for pharmacies that have a specific drug
    searchDrugInPharmacies(drugName) {
        const searchTerm = drugName.toLowerCase().trim();
        const results = [];

        this.pharmacies.forEach(pharmacy => {
            const matchingDrugs = pharmacy.inventory.filter(drug => 
                drug.name.toLowerCase().includes(searchTerm) ||
                drug.category.toLowerCase().includes(searchTerm)
            );

            if (matchingDrugs.length > 0) {
                // Calculate distance from user (placeholder - would use real geolocation)
                const distance = this.calculateDistance(pharmacy.coordinates);
                
                matchingDrugs.forEach(drug => {
                    results.push({
                        pharmacy: {
                            id: pharmacy.id,
                            name: pharmacy.name,
                            address: pharmacy.address,
                            phone: pharmacy.phone,
                            coordinates: pharmacy.coordinates,
                            services: pharmacy.services || [],
                            operatingHours: pharmacy.operatingHours || {}
                        },
                        drug: drug,
                        distance: distance,
                        availability: this.getStockStatus(drug.stock)
                    });
                });
            }
        });

        // Sort by distance and stock availability
        return results.sort((a, b) => {
            // Prioritize in-stock items
            if (a.availability !== b.availability) {
                if (a.availability === 'In Stock') return -1;
                if (b.availability === 'In Stock') return 1;
            }
            // Then sort by distance
            return parseFloat(a.distance) - parseFloat(b.distance);
        });
    }

    // Get pharmacy details by ID
    getPharmacyById(pharmacyId) {
        return this.pharmacies.find(pharmacy => pharmacy.id === pharmacyId);
    }

    // Get full inventory for a pharmacy
    getPharmacyInventory(pharmacyId) {
        const pharmacy = this.getPharmacyById(pharmacyId);
        return pharmacy ? pharmacy.inventory : [];
    }

    // Calculate distance (placeholder - would use real geolocation)
    calculateDistance(coordinates) {
        // For now, return random distance between 0.3 and 5.0 km
        // In real implementation, this would calculate actual distance from user's location
        const distances = ['0.3 km', '0.7 km', '1.2 km', '1.8 km', '2.1 km', '2.8 km', '3.2 km', '4.1 km', '4.7 km'];
        return distances[Math.floor(Math.random() * distances.length)];
    }

    // Get stock status text
    getStockStatus(stockCount) {
        if (stockCount === 0) return 'Out of Stock';
        if (stockCount < 20) return `Low Stock (${stockCount} left)`;
        return 'In Stock';
    }

    // Format price with currency
    formatPrice(price, currency = 'XAF') {
        return `${price.toLocaleString()} ${currency}`;
    }

    // Get pharmacies within a certain radius (placeholder)
    getNearbyPharmacies(userCoordinates, radiusKm = 10) {
        // In real implementation, this would calculate actual distances
        return this.pharmacies.map(pharmacy => ({
            ...pharmacy,
            distance: this.calculateDistance(pharmacy.coordinates)
        })).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    }

    // Get all unique drug categories
    getAllCategories() {
        const categories = new Set();
        this.pharmacies.forEach(pharmacy => {
            pharmacy.inventory.forEach(drug => {
                categories.add(drug.category);
            });
        });
        return Array.from(categories).sort();
    }

    // Get all unique drug names
    getAllDrugNames() {
        const drugs = new Set();
        this.pharmacies.forEach(pharmacy => {
            pharmacy.inventory.forEach(drug => {
                drugs.add(drug.name);
            });
        });
        return Array.from(drugs).sort();
    }

    // Search suggestions for autocomplete
    getSearchSuggestions(query) {
        const searchTerm = query.toLowerCase().trim();
        const suggestions = new Set();

        this.pharmacies.forEach(pharmacy => {
            pharmacy.inventory.forEach(drug => {
                if (drug.name.toLowerCase().includes(searchTerm)) {
                    suggestions.add(drug.name);
                }
                if (drug.category.toLowerCase().includes(searchTerm)) {
                    suggestions.add(drug.category);
                }
            });
        });

        return Array.from(suggestions).slice(0, 5); // Return top 5 suggestions
    }
}

// Initialize global pharmacy data manager
const pharmacyDataManager = new PharmacyDataManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PharmacyDataManager;
}
