const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../config/db');
const adminsModel = require('../models/admins');

const emailSchema = z.string().trim().email('Must be a valid email address');

// Ask for a line of text in the terminal. When hidden is true, typed
// characters are not echoed to the screen (used for the password).
// Backspace works; Ctrl+C aborts. Same helper as createAdmin.js.
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
          console.error('Aborted. The password was NOT changed.');
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

// Validate, hash and store a new password for an existing admin.
// Exported so it can be tested without a terminal. The new password is
// never logged - only short, fixed error messages are.
async function changeAdminPassword(email, newPassword) {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    throw new Error('That does not look like a valid email address.');
  }
  const cleanEmail = parsedEmail.data;

  if (typeof newPassword !== 'string' || newPassword.length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }

  // The email must belong to an admin - fail clearly when it does not
  const admin = await adminsModel.getAdminByEmail(cleanEmail);
  if (!admin) {
    throw new Error(`No admin found for ${cleanEmail}. Nothing was changed.`);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await adminsModel.updateAdminPassword(admin.id, passwordHash);
  if (!updated) {
    throw new Error('The password could not be saved. Please try again.');
  }
  return true;
}

async function main() {
  if (!pool) {
    console.error('ERROR: DATABASE_URL is not set.');
    console.error('Copy .env.example to .env and put your database URL in it, then run this again.');
    process.exit(1);
  }

  console.log('Change the password of an existing admin account.');
  console.log('The password is typed hidden, never shown, and never logged.');
  const email = await ask('Email: ');
  const password = await ask('New password: ', true);
  const confirm = await ask('Type it again: ', true);

  if (password !== confirm) {
    console.error('ERROR: The two passwords do not match. Nothing was changed.');
    process.exitCode = 1;
  } else {
    try {
      await changeAdminPassword(email, password);
      console.log('SUCCESS: password changed.');
    } catch (err) {
      console.error('ERROR: ' + err.message);
      process.exitCode = 1;
    }
  }

  await pool.end();
  console.log('Database connection closed.');
}

// Run interactively only when started directly (npm run admin:change-password)
if (require.main === module) {
  main().catch((err) => {
    console.error('ERROR: ' + err.message);
    process.exit(1);
  });
}

module.exports = { changeAdminPassword };
