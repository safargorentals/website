const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../config/db');
const adminsModel = require('../models/admins');

const emailSchema = z.string().trim().email('Must be a valid email address');

// Ask for a line of text in the terminal. When hidden is true, typed
// characters are not echoed to the screen (used for the password).
// Backspace works; Ctrl+C aborts.
function ask(question, hidden) {
  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      process.stdout.write('\n');
      return reject(
        new Error('This script needs an interactive terminal, so it refuses to run with piped input.')
      );
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          process.stdout.write('\n');
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          return resolve(value);
        }
        if (ch === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          console.error('Aborted. No admin was created.');
          process.exit(0);
        }
        if (ch === '\u007f') {
          // Backspace
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) process.stdout.write('\b \b');
          }
          continue;
        }
        value += ch;
        if (!hidden) process.stdout.write(ch);
      }
    };
    stdin.on('data', onData);
  });
}

// Validate, hash and insert an admin. Exported so it can be tested
// without a terminal. The password and its hash are never logged.
async function createAdmin(email, password) {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    throw new Error('That does not look like a valid email address.');
  }
  const cleanEmail = parsedEmail.data;

  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }

  // Refuse duplicates up front (the unique constraint is the backstop)
  const existing = await adminsModel.getAdminByEmail(cleanEmail);
  if (existing) {
    throw new Error('An admin with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    return await adminsModel.createAdmin(cleanEmail, passwordHash);
  } catch (err) {
    // 23505 = unique violation (someone created it between the check and the insert)
    if (err.code === '23505') {
      throw new Error('An admin with this email already exists.');
    }
    throw err;
  }
}

async function main() {
  if (!pool) {
    console.error('ERROR: DATABASE_URL is not set.');
    console.error('Copy .env.example to .env and put your database URL in it, then run this again.');
    process.exit(1);
  }

  console.log('Create a new admin account.');
  console.log('The password is typed hidden, never shown, and never logged.');
  const email = await ask('Email: ');
  const password = await ask('Password: ', true);

  try {
    await createAdmin(email, password);
    console.log('SUCCESS: admin account created.');
  } catch (err) {
    console.error('ERROR: ' + err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run interactively only when started directly (npm run admin:create)
if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR: ' + err.message);
    process.exit(1);
  });
}

module.exports = { createAdmin };
