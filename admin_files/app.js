// Configuration
const SUPABASE_URL = 'https://sjaszlinlzoigvdhvjhj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aPcOWsVDu0yL3-rVmYYPnw_ne4iXfyf';
const TABLE_NAME = 'snap';

const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA35OZdoQuOzpX0UbniA4r
HiKZvDrJ4vD2q1Ku8tWVvceVyAZtexGZ0Karkvahrl6qzHEhLNzrOw1V/s2+bju3
2llQDfK02reMDOQGNI71yH95O/gBh5KJjfvIRAutkQG3Ow0TFCg5lqWHWWFGKndP
8PDtUot1oKIuuxDw+tbG6s1zv+kUj9LlUxPTMSZmg8ICzwBkxHcvHuargw6JNfqD
/MfcwNmE8ITzM/octgHn9yo7e2AruzB/zW+G3WA59oBqwNeG3VOVphHRP16GCxC5
dLgaayiEEcc0mnuThP4Sw+/uX+yUM+foiWGSrZYFXyrdy/CI+RPY4O3z5mozDzWB
fSERQDJ+VBbmPe3EqVXJJwQVQdi8vjGzAl/M0cQW40MA0MSvYcj63c31MLGf0RCs
J0tCqSUEtQ1gLr8xMXhhwdEvXlDKJLztrpoye7PthmiZeNWQhH6bGryLazgEAJ17
o+paM6BDvpVGTFnrY1aP1q0H6GfMSZZewkoLRPX05ZQFeeTJoBDiOjvJGLjSnlsZ
3hkFZ147kvrIjCx3NHS3k4DVPFf7e3pFtSpV6suWtWydkD+sYmiRxDa2GuPAZW2o
pQEHUSLEEwSd5itR1Oy5hhWUkTAVMIGhWnTHM786QJzH6CHnbiXtw7yHGNH7GdfW
H4pchmfIkDjlyQgcrThL0NsCAwEAAQ==
-----END PUBLIC KEY-----`;

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Expose shared artifacts for admin.js
window.snapApp = {
  supabase,
  TABLE_NAME,
  RSA_PUBLIC_KEY: null,
  encryptData: null
};

// This file now only provides shared configuration for admin.js
// All public form functionality has been removed

const SAMPLE_ZIP_DATA = [
  { zip_code: '02108', latitude: 42.3601, longitude: -71.0589 },
  { zip_code: '02109', latitude: 42.3656, longitude: -71.0487 },
  { zip_code: '02110', latitude: 42.3535, longitude: -71.0382 },
  { zip_code: '02111', latitude: 42.3510, longitude: -71.0535 },
  { zip_code: '02113', latitude: 42.3648, longitude: -71.0428 },
  { zip_code: '02114', latitude: 42.3646, longitude: -71.0669 },
  { zip_code: '02115', latitude: 42.3373, longitude: -71.1038 },
  { zip_code: '02116', latitude: 42.3352, longitude: -71.0908 },
  { zip_code: '02118', latitude: 42.3372, longitude: -71.0827 },
  { zip_code: '02119', latitude: 42.3180, longitude: -71.0829 },
  { zip_code: '02120', latitude: 42.3383, longitude: -71.0950 },
  { zip_code: '02121', latitude: 42.3290, longitude: -71.0650 },
  { zip_code: '02122', latitude: 42.3215, longitude: -71.0470 },
  { zip_code: '02124', latitude: 42.3065, longitude: -71.0340 },
  { zip_code: '02125', latitude: 42.3202, longitude: -71.0142 },
  { zip_code: '02126', latitude: 42.2830, longitude: -71.0750 },
  { zip_code: '02127', latitude: 42.3352, longitude: -71.0630 },
  { zip_code: '02128', latitude: 42.3897, longitude: -71.0230 },
  { zip_code: '02129', latitude: 42.4053, longitude: -71.0315 },
  { zip_code: '02130', latitude: 42.3002, longitude: -71.1200 }
];

// Utility Functions
function generateGUID() {
  return crypto.randomUUID();
}

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = 'none';
}

// RSA Encryption
function encryptData(data) {
  try {
    const encrypt = new JSEncrypt();
    encrypt.setPublicKey(RSA_PUBLIC_KEY);
    const jsonString = JSON.stringify(data);
    
    // RSA 4096 can encrypt ~446 bytes at a time with PKCS1 padding
    // Be conservative with 380 bytes per chunk
    const maxLength = 380;
    const chunks = [];
    
    for (let i = 0; i < jsonString.length; i += maxLength) {
      const chunk = jsonString.substring(i, i + maxLength);
      const encrypted = encrypt.encrypt(chunk);
      if (!encrypted) {
        throw new Error('Encryption failed for chunk');
      }
      chunks.push(encrypted);
    }
    
    return chunks;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data: ' + error.message);
  }
}
// Attach to global for admin
window.snapApp.RSA_PUBLIC_KEY = RSA_PUBLIC_KEY;
window.snapApp.encryptData = encryptData;
// Auto-start admin on page load
window.addEventListener('DOMContentLoaded', () => {
  window.dispatchEvent(new Event('admin:open'));
});

// Removed: Role Selection and all public form handlers
/* REMOVED: All public form code
document.getElementById('recipientBtn').addEventListener('click', () => {
  currentRole = 'recipient';
  document.getElementById('recipientBtn').classList.add('active');
  document.getElementById('lenderBtn').classList.remove('active');
  hideElement('lenderForm');
  hideElement('successScreen');
  showElement('recipientForm');
});

document.getElementById('lenderBtn').addEventListener('click', () => {
  currentRole = 'lender';
  document.getElementById('lenderBtn').classList.add('active');
  document.getElementById('recipientBtn').classList.remove('active');
  hideElement('recipientForm');
  hideElement('successScreen');
  showElement('lenderForm');
});

// Contact Method Selection for Recipients
const contactMethodRadios = document.querySelectorAll('input[name="contactMethod"]');
contactMethodRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentContactMethod = e.target.value;
    
    // Hide all contact field groups
    hideElement('emailFields');
    hideElement('phoneFields');
    hideElement('mailFields');
    
    // Show selected group
    if (currentContactMethod === 'email') {
      showElement('emailFields');
      // Set required
      document.getElementById('recipientFirstName').required = true;
      document.getElementById('recipientEmail').required = true;
      document.getElementById('recipientEmailZip').required = true;
      // Clear others
      clearPhoneFields();
      clearMailFields();
    } else if (currentContactMethod === 'phone') {
      showElement('phoneFields');
      document.getElementById('recipientPhoneName').required = true;
      document.getElementById('recipientPhone').required = true;
      document.getElementById('recipientPhoneZip').required = true;
      clearEmailFields();
      clearMailFields();
    } else if (currentContactMethod === 'mail') {
      showElement('mailFields');
      document.getElementById('recipientMailName').required = true;
      document.getElementById('recipientAddress1').required = true;
      document.getElementById('recipientCity').required = true;
      document.getElementById('recipientState').required = true;
      document.getElementById('recipientMailZip').required = true;
      clearEmailFields();
      clearPhoneFields();
    }
  });
});

function clearEmailFields() {
  document.getElementById('recipientFirstName').value = '';
  document.getElementById('recipientEmail').value = '';
  document.getElementById('recipientEmailZip').value = '';
  document.getElementById('recipientFirstName').required = false;
  document.getElementById('recipientEmail').required = false;
  document.getElementById('recipientEmailZip').required = false;
}

function clearPhoneFields() {
  document.getElementById('recipientPhoneName').value = '';
  document.getElementById('recipientPhone').value = '';
  document.getElementById('recipientPhoneZip').value = '';
  document.getElementById('recipientPhoneName').required = false;
  document.getElementById('recipientPhone').required = false;
  document.getElementById('recipientPhoneZip').required = false;
}

function clearMailFields() {
  document.getElementById('recipientMailName').value = '';
  document.getElementById('recipientAddress1').value = '';
  document.getElementById('recipientAddress2').value = '';
  document.getElementById('recipientCity').value = '';
  document.getElementById('recipientState').value = '';
  document.getElementById('recipientMailZip').value = '';
  document.getElementById('recipientMailName').required = false;
  document.getElementById('recipientAddress1').required = false;
  document.getElementById('recipientCity').required = false;
  document.getElementById('recipientState').required = false;
  document.getElementById('recipientMailZip').required = false;
}

// Validate requested amount doesn't exceed benefit
document.getElementById('requestedAmount').addEventListener('input', () => {
  const benefit = parseFloat(document.getElementById('snapBenefit').value) || 0;
  const requested = parseFloat(document.getElementById('requestedAmount').value) || 0;
  
  if (requested > benefit) {
    showError('amountError', 'Requested amount cannot exceed your SNAP benefit amount');
  } else {
    hideError('amountError');
  }
});

// Recipient Form Submit
document.getElementById('recipientFormElement').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('amountError');
  
  // Validate contact method selected
  if (!currentContactMethod) {
    alert('Please select a contact method');
    return;
  }
  
  // Get form data based on contact method
  let firstName, contactInfo, zipCode;
  
  if (currentContactMethod === 'email') {
    firstName = document.getElementById('recipientFirstName').value.trim();
    const email = document.getElementById('recipientEmail').value.trim();
    zipCode = document.getElementById('recipientEmailZip').value.trim();
    
    if (!firstName || !email || !zipCode) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      alert('Zip code must be exactly 5 digits');
      return;
    }
    
    contactInfo = { email };
  } else if (currentContactMethod === 'phone') {
    firstName = document.getElementById('recipientPhoneName').value.trim();
    const phone = document.getElementById('recipientPhone').value.trim();
    zipCode = document.getElementById('recipientPhoneZip').value.trim();
    
    if (!firstName || !phone || !zipCode) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      alert('Zip code must be exactly 5 digits');
      return;
    }
    
    contactInfo = { phone };
  } else if (currentContactMethod === 'mail') {
    firstName = document.getElementById('recipientMailName').value.trim();
    const address1 = document.getElementById('recipientAddress1').value.trim();
    const address2 = document.getElementById('recipientAddress2').value.trim();
    const city = document.getElementById('recipientCity').value.trim();
    const state = document.getElementById('recipientState').value.trim().toUpperCase();
    zipCode = document.getElementById('recipientMailZip').value.trim();
    
    if (!firstName || !address1 || !city || !state || !zipCode) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (state.length !== 2 || !/^[A-Z]{2}$/.test(state)) {
      alert('State must be 2 letters (e.g., MA)');
      return;
    }
    
    if (zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
      alert('Zip code must be exactly 5 digits');
      return;
    }
    
    contactInfo = {
      address: `${address1}${address2 ? ', ' + address2 : ''}, ${city}, ${state} ${zipCode}`
    };
  }
  
  const snapBenefit = parseFloat(document.getElementById('snapBenefit').value);
  const requestedAmount = parseFloat(document.getElementById('requestedAmount').value);
  
  if (!snapBenefit || snapBenefit <= 0) {
    alert('Please enter your monthly SNAP benefit amount');
    return;
  }
  
  if (!requestedAmount || requestedAmount <= 0) {
    alert('Please enter how much you need to borrow');
    return;
  }
  
  if (requestedAmount > snapBenefit) {
    showError('amountError', 'Requested amount cannot exceed your SNAP benefit amount');
    return;
  }
  
  try {
    // Disable submit button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    // Generate GUID
    const guid = generateGUID();
    
    // Build data object
    const data = {
      type: 'lendee',
      guid: guid,
      firstName: firstName,
      contactMethod: currentContactMethod,
      contactInfo: contactInfo,
      zipCode: zipCode,
      snapEligible: snapBenefit,
      requestedAmount: requestedAmount,
      timestamp: new Date().toISOString()
    };
    
    // Encrypt data
    const encryptedChunks = encryptData(data);
    
    // Create payload
    const payload = {
      data: {
        type: 'lendee',
        encrypted_chunks: encryptedChunks,
        guid: guid
      }
    };
    
    // Insert to database
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert([payload]);
    
    if (error) throw error;
    
    // Show success screen
    hideElement('recipientForm');
    showElement('successScreen');
    
    document.getElementById('successTitle').textContent = '✓ Your request has been submitted';
    document.getElementById('confirmationGuid').textContent = guid;
    
    const contactMethodText = currentContactMethod === 'email' ? 'email' : 
                             currentContactMethod === 'phone' ? 'phone (SMS)' : 'mailing address';
    document.getElementById('successMessage').textContent = 
      `What happens next: An administrator will review your request and match you with a lender. They will contact you using the ${contactMethodText} information you provided.`;
    
    // Reset form
    e.target.reset();
    currentContactMethod = null;
    hideElement('emailFields');
    hideElement('phoneFields');
    hideElement('mailFields');
    contactMethodRadios.forEach(r => r.checked = false);
    
  } catch (error) {
    console.error('Submission error:', error);
    alert('Failed to submit request: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// Lender Form Submit
document.getElementById('lenderFormElement').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const firstName = document.getElementById('lenderFirstName').value.trim();
  const email = document.getElementById('lenderEmail').value.trim();
  const zipCode = document.getElementById('lenderZip').value.trim();
  const loanAmount = parseFloat(document.getElementById('loanAmount').value);
  
  // Validation
  if (!firstName || !email || !zipCode) {
    alert('Please fill in all required fields');
    return;
  }
  
  if (zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
    alert('Zip code must be exactly 5 digits');
    return;
  }
  
  if (!loanAmount || loanAmount <= 0) {
    alert('Please enter a loan amount greater than zero');
    return;
  }
  
  try {
    // Disable submit button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    // Generate GUID
    const guid = generateGUID();
    
    // Build data object
    const data = {
      type: 'lender',
      guid: guid,
      firstName: firstName,
      email: email,
      zipCode: zipCode,
      loanAmount: loanAmount,
      timestamp: new Date().toISOString()
    };
    
    // Encrypt data
    const encryptedChunks = encryptData(data);
    
    // Create payload
    const payload = {
      data: {
        type: 'lender',
        encrypted_chunks: encryptedChunks,
        guid: guid
      }
    };
    
    // Insert to database
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert([payload]);
    
    if (error) throw error;
    
    // Show success screen
    hideElement('lenderForm');
    showElement('successScreen');
    
    document.getElementById('successTitle').textContent = '✓ Thank you for helping!';
    document.getElementById('confirmationGuid').textContent = guid;
    document.getElementById('successMessage').textContent = 
      `What happens next: We will match your loan capacity with SNAP recipients in or near your area. An administrator will contact you at ${email} to arrange the loan details.`;
    
    // Reset form
    e.target.reset();
    
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    
  } catch (error) {
    console.error('Submission error:', error);
    alert('Failed to submit offer: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// Cancel buttons
document.getElementById('recipientCancelBtn').addEventListener('click', () => {
  hideElement('recipientForm');
  document.getElementById('recipientFormElement').reset();
  currentContactMethod = null;
  hideElement('emailFields');
  hideElement('phoneFields');
  hideElement('mailFields');
  contactMethodRadios.forEach(r => r.checked = false);
  document.getElementById('recipientBtn').classList.remove('active');
  currentRole = null;
});

document.getElementById('lenderCancelBtn').addEventListener('click', () => {
  hideElement('lenderForm');
  document.getElementById('lenderFormElement').reset();
  document.getElementById('lenderBtn').classList.remove('active');
  currentRole = null;
});

// Submit another button
document.getElementById('submitAnotherBtn').addEventListener('click', () => {
  hideElement('successScreen');
  document.getElementById('recipientBtn').classList.remove('active');
  document.getElementById('lenderBtn').classList.remove('active');
  currentRole = null;
});
*/
