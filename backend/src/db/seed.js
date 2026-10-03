const pool = require('../config/db');

// Four sample cars so the frontend has data to display.
// No admin account is created anywhere in this app.
const sampleCars = [
  {
    name: 'Toyota Corolla',
    brand: 'Toyota',
    type: 'sedan',
    seats: 5,
    transmission: 'automatic',
    fuel: 'petrol',
    price_per_day: 6500,
    currency: 'INR',
    images: ['https://placehold.co/800x500?text=Toyota+Corolla'],
    description: 'Comfortable, fuel-efficient sedan - a favourite for city and highway trips.',
    is_featured: true,
    featured_order: 1,
  },
  {
    name: 'Honda City',
    brand: 'Honda',
    type: 'sedan',
    seats: 5,
    transmission: 'automatic',
    fuel: 'petrol',
    price_per_day: 7000,
    currency: 'INR',
    images: ['https://placehold.co/800x500?text=Honda+City'],
    description: 'Spacious and smooth, ideal for family outings and business travel.',
    is_featured: false,
    featured_order: null,
  },
  {
    name: 'Suzuki Swift',
    brand: 'Suzuki',
    type: 'hatchback',
    seats: 5,
    transmission: 'automatic',
    fuel: 'petrol',
    price_per_day: 5500,
    currency: 'INR',
    images: ['https://placehold.co/800x500?text=Suzuki+Swift'],
    description: 'Small, agile and cheap to run - perfect for exploring the city.',
    is_featured: false,
    featured_order: null,
  },
  {
    name: 'Toyota Fortuner',
    brand: 'Toyota',
    type: 'suv',
    seats: 7,
    transmission: 'automatic',
    fuel: 'diesel',
    price_per_day: 18000,
    currency: 'INR',
    images: ['https://placehold.co/800x500?text=Toyota+Fortuner'],
    description: 'Rugged 7-seater SUV for long journeys and rough roads.',
    is_featured: true,
    featured_order: 2,
  },
];

async function main() {
  if (!pool) {
    console.error('ERROR: DATABASE_URL is not set.');
    console.error('Copy .env.example to .env and put your database URL in it, then run this again.');
    process.exitCode = 1;
    return;
  }

  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM cars');
    if (rows[0].count > 0) {
      console.log(`SKIPPED: the cars table already has ${rows[0].count} rows. Nothing was seeded.`);
    } else {
      const insert = `
        INSERT INTO cars
          (name, brand, type, seats, transmission, fuel, price_per_day, currency, images, description, is_featured, featured_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      for (const car of sampleCars) {
        await pool.query(insert, [
          car.name,
          car.brand,
          car.type,
          car.seats,
          car.transmission,
          car.fuel,
          car.price_per_day,
          car.currency,
          car.images,
          car.description,
          car.is_featured,
          car.featured_order,
        ]);
      }
      console.log(`SUCCESS: seeded ${sampleCars.length} sample cars.`);
    }
  } catch (err) {
    console.error('ERROR: seed failed.');
    console.error('Details: ' + err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

main();
