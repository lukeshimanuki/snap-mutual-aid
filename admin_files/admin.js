// Admin Console Application - Auto-login with built-in credentials
// Manages authentication, decryption, zip code loading, and matching algorithm

const ZIP_GEOLOCATION_URL = 'https://gist.githubusercontent.com/abatko/ee7b24db82a6f50cfce02afafa1dfd1e/raw/dd88ce02f2cb920e8ff6fa66052d9ab8a72ffb5a/US%2520Zip%2520Code%2520Geolocations%2520from%25202018%2520Government%2520Data';

// Admin State
const adminState = {
  user: null,
  privateKey: PRIVATE_KEY,
  zipData: [],
  lendees: [],
  lenders: [],
  matches: [],
  lendeeUpdates: [],
  lenderUpdates: [],
  matchUpdates: [],
  suggestedMatches: [],
  decrypt: null
};

// UI References
const ui = {
  loadingSection: null,
  zipLoaderSection: null,
  dataPanels: null,
  lendeesTable: null,
  lendersTable: null,
  suggestedTable: null,
  matchesTable: null,
  invalidatedTable: null
};

// Initialize when admin console opens
window.addEventListener('admin:open', initAdmin);

async function initAdmin() {
  if (ui.loadingSection) return; // Already initialized
  
  // Get UI references
  ui.loadingSection = document.getElementById('loadingSection');
  ui.zipLoaderSection = document.getElementById('zipLoaderSection');
  ui.dataPanels = document.getElementById('dataPanels');
  ui.lendeesTable = document.getElementById('lendeesTable').querySelector('tbody');
  ui.lendersTable = document.getElementById('lendersTable').querySelector('tbody');
  ui.suggestedTable = document.getElementById('suggestedTable').querySelector('tbody');
  ui.matchesTable = document.getElementById('matchesTable').querySelector('tbody');
  
  // Set up event listeners
  document.getElementById('overrideZipBtn').addEventListener('click', handleOverrideZip);
  document.getElementById('autoMatchBtn').addEventListener('click', handleAutoMatch);
  document.getElementById('approveAllSuggestionsBtn').addEventListener('click', handleApproveAllSuggestions);
  document.getElementById('addManualSuggestionBtn').addEventListener('click', handleAddManualSuggestion);
  document.getElementById('exportCsvBtn').addEventListener('click', handleExportCsv);
  
  // Auto-login and initialize
  await autoLogin();
}

async function autoLogin() {
  updateLoadingStatus('Authenticating...');
  
  try {
    // First check for existing session
    const { data: { session } } = await window.snapApp.supabase.auth.getSession();
    
    if (!session) {
      // Sign in with built-in credentials
      const { data, error } = await window.snapApp.supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });
      
      if (error) throw error;
      adminState.user = data.user;
    } else {
      adminState.user = session.user;
    }
    
    // Initialize private key for decryption
    updateLoadingStatus('Initializing decryption...');
    const decrypt = new JSEncrypt();
    decrypt.setPrivateKey(PRIVATE_KEY);
    adminState.decrypt = decrypt;
    
    // Load ZIP codes
    await loadZipCodes();
    
    // Load data from database
    await loadAllData();
    
    // Show dashboard
    ui.loadingSection.style.display = 'none';
    ui.zipLoaderSection.style.display = 'block';
    ui.dataPanels.style.display = 'block';
    
  } catch (error) {
    console.error('Auto-login error:', error);
    updateLoadingStatus('Failed to initialize: ' + error.message);
  }
}

function updateLoadingStatus(message) {
  const statusEl = document.getElementById('loadingStatus');
  if (statusEl) statusEl.textContent = message;
}



async function loadZipCodes() {
  const statusEl = document.getElementById('zipStatus');
  statusEl.textContent = 'Loading US ZIP codes from government data...';
  
  try {
    const response = await fetch(ZIP_GEOLOCATION_URL);
    const text = await response.text();
    
    // Parse CSV
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    adminState.zipData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= 3) {
        const zipCode = values[0]?.trim();
        const latitude = parseFloat(values[1]);
        const longitude = parseFloat(values[2]);
        
        if (zipCode && !isNaN(latitude) && !isNaN(longitude)) {
          adminState.zipData.push({ zip_code: zipCode, latitude, longitude });
        }
      }
    }
    
    statusEl.textContent = `Loaded ${adminState.zipData.length} ZIP codes successfully.`;
    statusEl.className = 'success-message';
  } catch (error) {
    console.error('ZIP load error:', error);
    statusEl.textContent = 'Failed to load ZIP codes: ' + error.message;
    statusEl.className = 'error-message';
  }
}

async function handleOverrideZip() {
  const fileInput = document.getElementById('zipCsvInput');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select a CSV file');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      adminState.zipData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 3) {
          const zipCode = values[0]?.trim();
          const latitude = parseFloat(values[1]);
          const longitude = parseFloat(values[2]);
          
          if (zipCode && !isNaN(latitude) && !isNaN(longitude)) {
            adminState.zipData.push({ zip_code: zipCode, latitude, longitude });
          }
        }
      }
      
      const statusEl = document.getElementById('zipStatus');
      statusEl.textContent = `Overridden with ${adminState.zipData.length} ZIP codes from CSV.`;
      statusEl.className = 'success-message';
      fileInput.value = '';
    } catch (error) {
      console.error('CSV parse error:', error);
      alert('Failed to parse CSV: ' + error.message);
    }
  };
  reader.readAsText(file);
}

async function loadAllData() {
  try {
    // Fetch all records from database
    const { data: records, error } = await window.snapApp.supabase
      .from(window.snapApp.TABLE_NAME)
      .select('*');
    
    if (error) throw error;
    
    adminState.lendees = [];
    adminState.lenders = [];
    adminState.matches = [];
    adminState.lendeeUpdates = [];
    adminState.lenderUpdates = [];
    adminState.matchUpdates = [];
    
    // Decrypt and categorize records
    for (const record of records) {
      try {
        const decrypted = decryptRecord(record);
        
        if (decrypted.type === 'lendee') {
          adminState.lendees.push({
            id: record.id,
            guid: decrypted.guid,
            firstName: decrypted.firstName,
            contactMethod: decrypted.contactMethod,
            contactInfo: decrypted.contactInfo,
            zipCode: decrypted.zipCode,
            requestedAmount: decrypted.requestedAmount,
            snapEligible: decrypted.snapEligible,
            timestamp: decrypted.timestamp,
            matchedAmount: 0
          });
        } else if (decrypted.type === 'lender') {
          adminState.lenders.push({
            id: record.id,
            guid: decrypted.guid,
            firstName: decrypted.firstName,
            email: decrypted.email,
            zipCode: decrypted.zipCode,
            loanAmount: decrypted.loanAmount,
            timestamp: decrypted.timestamp,
            usedAmount: 0
          });
        } else if (decrypted.type === 'match') {
          adminState.matches.push({
            id: record.id,
            guid: record.id,
            lendeeGuid: decrypted.lendeeGuid,
            lenderGuid: decrypted.lenderGuid,
            amount: decrypted.amount,
            timestamp: decrypted.timestamp,
            status: decrypted.status || 'pending'
          });
        } else if (decrypted.type === 'lendee_update') {
          adminState.lendeeUpdates.push({
            id: record.id,
            lendeeGuid: decrypted.lendee_guid || decrypted.lendeeGuid,
            newRequestedAmount: decrypted.new_requested_amount || decrypted.newRequestedAmount,
            timestamp: decrypted.timestamp
          });
        } else if (decrypted.type === 'lender_update') {
          adminState.lenderUpdates.push({
            id: record.id,
            lenderGuid: decrypted.lender_guid || decrypted.lenderGuid,
            newCapacity: decrypted.new_capacity || decrypted.newCapacity,
            timestamp: decrypted.timestamp
          });
        } else if (decrypted.type === 'match_update') {
          adminState.matchUpdates.push({
            id: record.id,
            matchGuid: decrypted.match_guid || decrypted.matchGuid,
            newAmount: decrypted.new_amount || decrypted.newAmount,
            timestamp: decrypted.timestamp
          });
        }
      } catch (decryptError) {
        console.error('Decryption failed for record:', record.id, decryptError);
      }
    }
    
    // Apply updates to get latest values
    applyUpdates();
    
    // Calculate matched/used amounts
    calculateMatchedAmounts();
    
    // Render tables
    renderLendeesTable();
    renderLendersTable();
    renderMatchesTable();
    populateManualSelects();
    updateCsvPreview();
    
  } catch (error) {
    console.error('Load data error:', error);
    alert('Failed to load data: ' + error.message);
  }
}

function decryptRecord(record) {
  if (!adminState.decrypt) {
    throw new Error('Private key not set');
  }
  
  const encryptedChunks = record.data?.encrypted_chunks || [];
  
  if (!encryptedChunks.length) {
    throw new Error('No encrypted data');
  }
  
  // Decrypt each chunk
  const decryptedChunks = [];
  for (const chunk of encryptedChunks) {
    const decrypted = adminState.decrypt.decrypt(chunk);
    if (!decrypted) {
      throw new Error('Decryption failed for chunk');
    }
    decryptedChunks.push(decrypted);
  }
  
  // Combine and parse
  const jsonString = decryptedChunks.join('');
  return JSON.parse(jsonString);
}

function applyUpdates() {
  // Apply lendee updates
  for (const update of adminState.lendeeUpdates) {
    const lendee = adminState.lendees.find(l => l.guid === update.lendeeGuid);
    if (lendee) {
      lendee.requestedAmount = update.newRequestedAmount;
    }
  }
  
  // Apply lender updates
  for (const update of adminState.lenderUpdates) {
    const lender = adminState.lenders.find(l => l.guid === update.lenderGuid);
    if (lender) {
      lender.loanAmount = update.newCapacity;
    }
  }
  
  // Apply match updates
  for (const update of adminState.matchUpdates) {
    const match = adminState.matches.find(m => m.guid === update.matchGuid);
    if (match) {
      match.amount = update.newAmount;
    }
  }
}

function calculateMatchedAmounts() {
  // Reset
  adminState.lendees.forEach(l => l.matchedAmount = 0);
  adminState.lenders.forEach(l => l.usedAmount = 0);
  
  // Sum up from all matches (using latest amounts)
  for (const match of adminState.matches) {
    const lendee = adminState.lendees.find(l => l.guid === match.lendeeGuid);
    const lender = adminState.lenders.find(l => l.guid === match.lenderGuid);
    
    if (lendee) lendee.matchedAmount += match.amount;
    if (lender) lender.usedAmount += match.amount;
  }
}

function renderLendeesTable() {
  ui.lendeesTable.innerHTML = '';
  
  for (const lendee of adminState.lendees) {
    const outstanding = lendee.requestedAmount - lendee.matchedAmount;
    const row = document.createElement('tr');
    row.className = 'clickable-row';
    row.onclick = () => showLendeeDetail(lendee.guid);
    row.innerHTML = `
      <td>${lendee.firstName}</td>
      <td>${lendee.zipCode}</td>
      <td>$${lendee.requestedAmount}</td>
      <td>$${lendee.matchedAmount}</td>
      <td>$${outstanding}</td>
    `;
    ui.lendeesTable.appendChild(row);
  }
}

function renderLendersTable() {
  ui.lendersTable.innerHTML = '';
  
  for (const lender of adminState.lenders) {
    const remaining = lender.loanAmount - lender.usedAmount;
    const row = document.createElement('tr');
    row.className = 'clickable-row';
    row.onclick = () => showLenderDetail(lender.guid);
    row.innerHTML = `
      <td>${lender.firstName}</td>
      <td>${lender.zipCode}</td>
      <td>$${lender.loanAmount}</td>
      <td>$${lender.usedAmount}</td>
      <td>$${remaining}</td>
    `;
    ui.lendersTable.appendChild(row);
  }
}

function renderMatchesTable() {
  ui.matchesTable.innerHTML = '';
  
  for (const match of adminState.matches) {
    const lendee = adminState.lendees.find(l => l.guid === match.lendeeGuid);
    const lender = adminState.lenders.find(l => l.guid === match.lenderGuid);
    
    // Format contact info
    let lendeeContact = 'N/A';
    if (lendee) {
      if (lendee.contactMethod === 'email' && lendee.contactInfo.email) {
        lendeeContact = lendee.contactInfo.email;
      } else if (lendee.contactMethod === 'phone' && lendee.contactInfo.phone) {
        lendeeContact = lendee.contactInfo.phone;
      } else if (lendee.contactMethod === 'mail' && lendee.contactInfo.address) {
        lendeeContact = lendee.contactInfo.address;
      }
    }
    
    const lenderContact = lender?.email || 'N/A';
    const dateCreated = match.timestamp ? new Date(match.timestamp).toLocaleDateString() : 'N/A';
    
    const row = document.createElement('tr');
    row.className = 'clickable-row';
    row.onclick = () => showMatchDetail(match.guid);
    row.innerHTML = `
      <td>${lendee?.firstName || 'Unknown'}</td>
      <td>${lender?.firstName || 'Unknown'}</td>
      <td>$${match.amount}</td>
      <td>${lendeeContact}</td>
      <td>${lenderContact}</td>
      <td>${dateCreated}</td>
    `;
    ui.matchesTable.appendChild(row);
  }
}



function renderSuggestedTable() {
  ui.suggestedTable.innerHTML = '';
  const hasApprovalReady = adminState.suggestedMatches.length > 0;
  document.getElementById('approveAllSuggestionsBtn').disabled = !hasApprovalReady;
  
  let index = 0;
  for (const suggestion of adminState.suggestedMatches) {
    const lendee = adminState.lendees.find(l => l.guid === suggestion.lendeeGuid);
    const lender = adminState.lenders.find(l => l.guid === suggestion.lenderGuid);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" class="suggestion-checkbox" data-index="${index}" checked></td>
      <td>${lendee?.firstName || 'Unknown'}</td>
      <td>${lender?.firstName || 'Unknown'}</td>
      <td>$${suggestion.amount}</td>
      <td>${suggestion.distance?.toFixed(2) || 'N/A'}</td>
      <td>${suggestion.utilizationScore?.toFixed(2) || 'N/A'}</td>
      <td>${suggestion.source || 'auto'}</td>
      <td>
        <button class="btn btn--sm btn--primary" onclick="approveSuggestion(${index})">Approve</button>
        <button class="btn btn--sm btn--outline" onclick="removeSuggestion(${index})">Remove</button>
      </td>
    `;
    ui.suggestedTable.appendChild(row);
    index++;
  }
}

function populateManualSelects() {
  const lendeeSelect = document.getElementById('manualLendee');
  const lenderSelect = document.getElementById('manualLender');
  
  lendeeSelect.innerHTML = '<option value="">-- Select Lendee --</option>';
  for (const lendee of adminState.lendees) {
    const outstanding = lendee.requestedAmount - lendee.matchedAmount;
    if (outstanding > 0) {
      const option = document.createElement('option');
      option.value = lendee.guid;
      option.textContent = `${lendee.firstName} (${lendee.zipCode}) - $${outstanding} needed`;
      lendeeSelect.appendChild(option);
    }
  }
  
  lenderSelect.innerHTML = '<option value="">-- Select Lender --</option>';
  for (const lender of adminState.lenders) {
    const remaining = lender.loanAmount - lender.usedAmount;
    if (remaining > 0) {
      const option = document.createElement('option');
      option.value = lender.guid;
      option.textContent = `${lender.firstName} (${lender.zipCode}) - $${remaining} available`;
      lenderSelect.appendChild(option);
    }
  }
}

function handleAutoMatch() {
  // Run unified matching algorithm: distance + balance
  adminState.suggestedMatches = [];
  
  // Clone lendees and lenders for tracking remaining needs
  const needyLendees = adminState.lendees
    .map(l => ({
      ...l,
      outstanding: l.requestedAmount - l.matchedAmount
    }))
    .filter(l => l.outstanding > 0);
  
  const availableLenders = adminState.lenders
    .map(l => ({
      ...l,
      remaining: l.loanAmount - l.usedAmount
    }))
    .filter(l => l.remaining > 0);
  
  if (needyLendees.length === 0) {
    alert('No lendees with outstanding needs.');
    return;
  }
  
  if (availableLenders.length === 0) {
    alert('No lenders with remaining capacity.');
    return;
  }
  
  // Compute all possible pairings with scores
  const pairings = [];
  for (const lendee of needyLendees) {
    for (const lender of availableLenders) {
      const distance = calculateDistance(
        lendee.zipCode,
        lender.zipCode
      );
      
      // Calculate utilization balance score
      // We want to evenly distribute loan usage across lenders
      // Lower utilizationScore = more balanced usage
      const currentUtilization = lender.usedAmount / lender.loanAmount;
      
      // Combined score: distance (km) + utilization penalty
      // Normalize distance to 0-1 scale (assume max 5000km)
      const normalizedDistance = Math.min(distance / 5000, 1);
      const score = normalizedDistance + currentUtilization;
      
      pairings.push({
        lendeeGuid: lendee.guid,
        lenderGuid: lender.guid,
        distance,
        utilizationScore: currentUtilization,
        score,
        maxAmount: Math.min(lendee.outstanding, lender.remaining)
      });
    }
  }
  
  // Sort by score (lower is better)
  pairings.sort((a, b) => a.score - b.score);
  
  // Greedy assignment: pick best pairing, allocate, repeat
  const assigned = new Set();
  const lenderRemaining = {};
  availableLenders.forEach(l => lenderRemaining[l.guid] = l.remaining);
  const lendeeOutstanding = {};
  needyLendees.forEach(l => lendeeOutstanding[l.guid] = l.outstanding);
  
  for (const pair of pairings) {
    const lendeeNeed = lendeeOutstanding[pair.lendeeGuid] || 0;
    const lenderCap = lenderRemaining[pair.lenderGuid] || 0;
    
    if (lendeeNeed > 0 && lenderCap > 0) {
      const amount = Math.min(lendeeNeed, lenderCap);
      
      adminState.suggestedMatches.push({
        lendeeGuid: pair.lendeeGuid,
        lenderGuid: pair.lenderGuid,
        amount,
        distance: pair.distance,
        utilizationScore: pair.utilizationScore,
        source: 'auto'
      });
      
      lendeeOutstanding[pair.lendeeGuid] -= amount;
      lenderRemaining[pair.lenderGuid] -= amount;
    }
  }
  
  renderSuggestedTable();
  alert(`Generated ${adminState.suggestedMatches.length} suggested matches.`);
}

function calculateDistance(zip1, zip2) {
  const loc1 = adminState.zipData.find(z => z.zip_code === zip1);
  const loc2 = adminState.zipData.find(z => z.zip_code === zip2);
  
  if (!loc1 || !loc2) {
    return 9999; // Unknown location, penalize heavily
  }
  
  // Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = toRadians(loc2.latitude - loc1.latitude);
  const dLon = toRadians(loc2.longitude - loc1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(loc1.latitude)) * Math.cos(toRadians(loc2.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function handleAddManualSuggestion() {
  const lendeeGuid = document.getElementById('manualLendee').value;
  const lenderGuid = document.getElementById('manualLender').value;
  const amount = parseFloat(document.getElementById('manualAmount').value);
  
  if (!lendeeGuid || !lenderGuid || !amount || amount <= 0) {
    alert('Please select lendee, lender, and enter a valid amount.');
    return;
  }
  
  const lendee = adminState.lendees.find(l => l.guid === lendeeGuid);
  const lender = adminState.lenders.find(l => l.guid === lenderGuid);
  
  const lendeeOutstanding = lendee.requestedAmount - lendee.matchedAmount;
  const lenderRemaining = lender.loanAmount - lender.usedAmount;
  
  if (amount > lendeeOutstanding) {
    alert(`Amount exceeds lendee outstanding need ($${lendeeOutstanding})`);
    return;
  }
  
  if (amount > lenderRemaining) {
    alert(`Amount exceeds lender remaining capacity ($${lenderRemaining})`);
    return;
  }
  
  const distance = calculateDistance(lendee.zipCode, lender.zipCode);
  
  adminState.suggestedMatches.push({
    lendeeGuid,
    lenderGuid,
    amount,
    distance,
    utilizationScore: lender.usedAmount / lender.loanAmount,
    source: 'manual'
  });
  
  renderSuggestedTable();
  
  const infoEl = document.getElementById('manualMatchInfo');
  infoEl.textContent = `Manual suggestion added: ${lendee.firstName} ↔ ${lender.firstName} for $${amount}`;
  infoEl.style.display = 'block';
  
  // Reset form
  document.getElementById('manualLendee').value = '';
  document.getElementById('manualLender').value = '';
  document.getElementById('manualAmount').value = '';
}

window.approveSuggestion = async function(index) {
  const suggestion = adminState.suggestedMatches[index];
  if (!suggestion) return;
  
  try {
    await createMatch(suggestion);
    adminState.suggestedMatches.splice(index, 1);
    await loadAllData();
    renderSuggestedTable();
    alert('Match approved and saved.');
  } catch (error) {
    console.error('Approve error:', error);
    alert('Failed to approve match: ' + error.message);
  }
};

window.removeSuggestion = function(index) {
  adminState.suggestedMatches.splice(index, 1);
  renderSuggestedTable();
};

async function handleApproveAllSuggestions() {
  const checkboxes = document.querySelectorAll('.suggestion-checkbox:checked');
  const toApprove = [];
  
  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.index);
    if (adminState.suggestedMatches[idx]) {
      toApprove.push(adminState.suggestedMatches[idx]);
    }
  });
  
  if (toApprove.length === 0) {
    alert('No suggestions selected.');
    return;
  }
  
  if (!confirm(`Approve ${toApprove.length} selected match(es)?`)) {
    return;
  }
  
  try {
    for (const suggestion of toApprove) {
      await createMatch(suggestion);
    }
    
    adminState.suggestedMatches = [];
    await loadAllData();
    renderSuggestedTable();
    alert(`${toApprove.length} match(es) approved and saved.`);
  } catch (error) {
    console.error('Approve all error:', error);
    alert('Failed to approve matches: ' + error.message);
  }
}

async function createMatch(suggestion) {
  const matchGuid = crypto.randomUUID();
  const matchData = {
    type: 'match',
    guid: matchGuid,
    lendeeGuid: suggestion.lendeeGuid,
    lenderGuid: suggestion.lenderGuid,
    amount: suggestion.amount,
    status: 'approved',
    timestamp: new Date().toISOString()
  };
  
  // Encrypt match data
  const encryptedChunks = window.snapApp.encryptData(matchData);
  
  const payload = {
    data: {
      type: 'match',
      encrypted_chunks: encryptedChunks
    }
  };
  
  const { error } = await window.snapApp.supabase
    .from(window.snapApp.TABLE_NAME)
    .insert([payload]);
  
  if (error) throw error;
}

window.editMatch = function(matchGuid) {
  showMatchDetail(matchGuid);
};

window.deleteMatch = async function(matchGuid) {
  if (!confirm('Delete this match? This will remove it from the system.')) return;
  
  try {
    // Find the match in our local state
    const matchIndex = adminState.matches.findIndex(m => m.guid === matchGuid);
    if (matchIndex >= 0) {
      const match = adminState.matches[matchIndex];
      
      // Delete from database
      const { error } = await window.snapApp.supabase
        .from(window.snapApp.TABLE_NAME)
        .delete()
        .eq('id', match.id);
      
      if (error) throw error;
      
      // Reload data to reflect changes
      await loadAllData();
      alert('Match deleted successfully.');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Failed to delete match: ' + error.message);
  }
};

function updateCsvPreview() {
  const csv = generateCsv();
  const previewEl = document.getElementById('csvPreviewText');
  if (previewEl) {
    // Show first 10 lines as preview
    const lines = csv.split('\n');
    const preview = lines.slice(0, 11).join('\n');
    previewEl.textContent = preview + (lines.length > 11 ? '\n...' : '');
  }
}

// Modal and Detail Functions
window.closeModal = function() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.style.display = 'none';
};

function showModal(title, bodyContent) {
  const modal = document.getElementById('detailModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyContent;
  modal.style.display = 'flex';
}

function showLendeeDetail(lendeeGuid) {
  const lendee = adminState.lendees.find(l => l.guid === lendeeGuid);
  if (!lendee) return;
  
  // Get update history
  const updates = adminState.lendeeUpdates
    .filter(u => u.lendeeGuid === lendeeGuid)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Format contact info
  let contactInfo = '';
  if (lendee.contactMethod === 'email' && lendee.contactInfo.email) {
    contactInfo = `Email: ${lendee.contactInfo.email}`;
  } else if (lendee.contactMethod === 'phone' && lendee.contactInfo.phone) {
    contactInfo = `Phone: ${lendee.contactInfo.phone}`;
  } else if (lendee.contactMethod === 'mail' && lendee.contactInfo.address) {
    contactInfo = `Address: ${lendee.contactInfo.address}`;
  }
  
  let historyHtml = '<table class="history-table"><thead><tr><th>Date</th><th>Time</th><th>Previous Amount</th><th>New Amount</th><th>Source</th></tr></thead><tbody>';
  
  // Add original
  const originalDate = lendee.timestamp ? new Date(lendee.timestamp) : new Date();
  historyHtml += `<tr><td>${originalDate.toLocaleDateString()}</td><td>${originalDate.toLocaleTimeString()}</td><td>-</td><td>$${lendee.snapEligible || lendee.requestedAmount}</td><td>Original</td></tr>`;
  
  // Add updates
  let prevAmount = lendee.snapEligible || lendee.requestedAmount;
  for (const update of updates) {
    const updateDate = new Date(update.timestamp);
    historyHtml += `<tr><td>${updateDate.toLocaleDateString()}</td><td>${updateDate.toLocaleTimeString()}</td><td>$${prevAmount}</td><td>$${update.newRequestedAmount}</td><td>Update</td></tr>`;
    prevAmount = update.newRequestedAmount;
  }
  
  historyHtml += '</tbody></table>';
  
  const bodyContent = `
    <div class="detail-section">
      <h4>Contact Information</h4>
      <div class="detail-grid">
        <div class="detail-label">Name:</div>
        <div class="detail-value">${lendee.firstName}</div>
        <div class="detail-label">Contact:</div>
        <div class="detail-value">${contactInfo}</div>
        <div class="detail-label">Zip Code:</div>
        <div class="detail-value">${lendee.zipCode}</div>
        <div class="detail-label">UUID:</div>
        <div class="detail-value" style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">${lendee.guid}</div>
        <div class="detail-label">Timestamp:</div>
        <div class="detail-value">${originalDate.toLocaleString()}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Current Amounts</h4>
      <div class="detail-grid">
        <div class="detail-label">Requested:</div>
        <div class="detail-value">$${lendee.requestedAmount}</div>
        <div class="detail-label">Matched:</div>
        <div class="detail-value">$${lendee.matchedAmount}</div>
        <div class="detail-label">Outstanding:</div>
        <div class="detail-value">$${lendee.requestedAmount - lendee.matchedAmount}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>History of Amount Changes</h4>
      ${historyHtml}
    </div>
    <div class="edit-form">
      <h4>Update Requested Amount</h4>
      <div class="form-group">
        <label class="form-label">New Requested Amount</label>
        <input type="number" id="newLendeeAmount" class="form-control" value="${lendee.requestedAmount}" min="0" step="1">
      </div>
      <button class="btn btn--primary" onclick="updateLendeeAmount('${lendeeGuid}')">Update Amount</button>
    </div>
  `;
  
  showModal('Lendee Details', bodyContent);
}

function showLenderDetail(lenderGuid) {
  const lender = adminState.lenders.find(l => l.guid === lenderGuid);
  if (!lender) return;
  
  // Get update history
  const updates = adminState.lenderUpdates
    .filter(u => u.lenderGuid === lenderGuid)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  let historyHtml = '<table class="history-table"><thead><tr><th>Date</th><th>Time</th><th>Previous Capacity</th><th>New Capacity</th><th>Source</th></tr></thead><tbody>';
  
  // Add original
  const originalDate = lender.timestamp ? new Date(lender.timestamp) : new Date();
  const originalCapacity = updates.length > 0 ? 
    (adminState.lenders.find(l => l.guid === lenderGuid && !updates.some(u => u.lenderGuid === l.guid))?.loanAmount || lender.loanAmount) : 
    lender.loanAmount;
  historyHtml += `<tr><td>${originalDate.toLocaleDateString()}</td><td>${originalDate.toLocaleTimeString()}</td><td>-</td><td>$${originalCapacity}</td><td>Original</td></tr>`;
  
  // Add updates
  let prevAmount = originalCapacity;
  for (const update of updates) {
    const updateDate = new Date(update.timestamp);
    historyHtml += `<tr><td>${updateDate.toLocaleDateString()}</td><td>${updateDate.toLocaleTimeString()}</td><td>$${prevAmount}</td><td>$${update.newCapacity}</td><td>Update</td></tr>`;
    prevAmount = update.newCapacity;
  }
  
  historyHtml += '</tbody></table>';
  
  const bodyContent = `
    <div class="detail-section">
      <h4>Contact Information</h4>
      <div class="detail-grid">
        <div class="detail-label">Name:</div>
        <div class="detail-value">${lender.firstName}</div>
        <div class="detail-label">Email:</div>
        <div class="detail-value">${lender.email}</div>
        <div class="detail-label">Zip Code:</div>
        <div class="detail-value">${lender.zipCode}</div>
        <div class="detail-label">UUID:</div>
        <div class="detail-value" style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">${lender.guid}</div>
        <div class="detail-label">Timestamp:</div>
        <div class="detail-value">${originalDate.toLocaleString()}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Current Amounts</h4>
      <div class="detail-grid">
        <div class="detail-label">Capacity:</div>
        <div class="detail-value">$${lender.loanAmount}</div>
        <div class="detail-label">Allocated:</div>
        <div class="detail-value">$${lender.usedAmount}</div>
        <div class="detail-label">Available:</div>
        <div class="detail-value">$${lender.loanAmount - lender.usedAmount}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>History of Capacity Changes</h4>
      ${historyHtml}
    </div>
    <div class="edit-form">
      <h4>Update Lend Capacity</h4>
      <div class="form-group">
        <label class="form-label">New Capacity</label>
        <input type="number" id="newLenderCapacity" class="form-control" value="${lender.loanAmount}" min="0" step="1">
      </div>
      <button class="btn btn--primary" onclick="updateLenderCapacity('${lenderGuid}')">Update Capacity</button>
    </div>
  `;
  
  showModal('Lender Details', bodyContent);
}

function showMatchDetail(matchGuid) {
  const match = adminState.matches.find(m => m.guid === matchGuid);
  if (!match) return;
  
  const lendee = adminState.lendees.find(l => l.guid === match.lendeeGuid);
  const lender = adminState.lenders.find(l => l.guid === match.lenderGuid);
  
  // Get update history
  const updates = adminState.matchUpdates
    .filter(u => u.matchGuid === matchGuid)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  let historyHtml = '<table class="history-table"><thead><tr><th>Date</th><th>Time</th><th>Previous Amount</th><th>New Amount</th></tr></thead><tbody>';
  
  // Add original
  const originalDate = match.timestamp ? new Date(match.timestamp) : new Date();
  const originalAmount = updates.length > 0 ?
    (adminState.matches.find(m => m.guid === matchGuid && !updates.some(u => u.matchGuid === m.guid))?.amount || match.amount) :
    match.amount;
  historyHtml += `<tr><td>${originalDate.toLocaleDateString()}</td><td>${originalDate.toLocaleTimeString()}</td><td>-</td><td>$${originalAmount}</td></tr>`;
  
  // Add updates
  let prevAmount = originalAmount;
  for (const update of updates) {
    const updateDate = new Date(update.timestamp);
    historyHtml += `<tr><td>${updateDate.toLocaleDateString()}</td><td>${updateDate.toLocaleTimeString()}</td><td>$${prevAmount}</td><td>$${update.newAmount}</td></tr>`;
    prevAmount = update.newAmount;
  }
  
  historyHtml += '</tbody></table>';
  
  const bodyContent = `
    <div class="detail-section">
      <h4>Match Information</h4>
      <div class="detail-grid">
        <div class="detail-label">Lendee Name:</div>
        <div class="detail-value">${lendee?.firstName || 'Unknown'}</div>
        <div class="detail-label">Lendee UUID:</div>
        <div class="detail-value" style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">${match.lendeeGuid}</div>
        <div class="detail-label">Lender Name:</div>
        <div class="detail-value">${lender?.firstName || 'Unknown'}</div>
        <div class="detail-label">Lender UUID:</div>
        <div class="detail-value" style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">${match.lenderGuid}</div>
        <div class="detail-label">Current Amount:</div>
        <div class="detail-value">$${match.amount}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>History of Amount Changes</h4>
      ${historyHtml}
    </div>
    <div class="edit-form">
      <h4>Update Match Amount</h4>
      <div class="form-group">
        <label class="form-label">New Amount</label>
        <input type="number" id="newMatchAmount" class="form-control" value="${match.amount}" min="0" step="1">
      </div>
      <button class="btn btn--primary" onclick="updateMatchAmount('${matchGuid}')">Update Amount</button>
    </div>
  `;
  
  showModal('Match Details', bodyContent);
}

window.updateLendeeAmount = async function(lendeeGuid) {
  const inputEl = document.getElementById('newLendeeAmount');
  if (!inputEl) {
    alert('Input field not found');
    return;
  }
  
  const newAmount = parseFloat(inputEl.value);
  
  if (isNaN(newAmount) || newAmount < 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  try {
    // Show loading state
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    const updateData = {
      type: 'lendee_update',
      lendee_guid: lendeeGuid,
      new_requested_amount: newAmount,
      timestamp: new Date().toISOString()
    };
    
    console.log('Creating lendee update record:', updateData);
    
    const encryptedChunks = window.snapApp.encryptData(updateData);
    
    const payload = {
      data: {
        type: 'lendee_update',
        encrypted_chunks: encryptedChunks
      }
    };
    
    const { data, error } = await window.snapApp.supabase
      .from(window.snapApp.TABLE_NAME)
      .insert([payload])
      .select();
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Update record created successfully:', data);
    
    // Re-fetch all data
    await loadAllData();
    
    // Close modal
    closeModal();
    
    // Show success
    alert('Lendee amount updated successfully. All tables have been refreshed.');
  } catch (error) {
    console.error('Update error:', error);
    alert('Failed to update amount: ' + error.message);
  }
};

window.updateLenderCapacity = async function(lenderGuid) {
  const inputEl = document.getElementById('newLenderCapacity');
  if (!inputEl) {
    alert('Input field not found');
    return;
  }
  
  const newCapacity = parseFloat(inputEl.value);
  
  if (isNaN(newCapacity) || newCapacity < 0) {
    alert('Please enter a valid capacity');
    return;
  }
  
  try {
    // Show loading state
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    const updateData = {
      type: 'lender_update',
      lender_guid: lenderGuid,
      new_capacity: newCapacity,
      timestamp: new Date().toISOString()
    };
    
    console.log('Creating lender update record:', updateData);
    
    const encryptedChunks = window.snapApp.encryptData(updateData);
    
    const payload = {
      data: {
        type: 'lender_update',
        encrypted_chunks: encryptedChunks
      }
    };
    
    const { data, error } = await window.snapApp.supabase
      .from(window.snapApp.TABLE_NAME)
      .insert([payload])
      .select();
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Update record created successfully:', data);
    
    // Re-fetch all data
    await loadAllData();
    
    // Close modal
    closeModal();
    
    // Show success
    alert('Lender capacity updated successfully. All tables have been refreshed.');
  } catch (error) {
    console.error('Update error:', error);
    alert('Failed to update capacity: ' + error.message);
  }
};

window.updateMatchAmount = async function(matchGuid) {
  const inputEl = document.getElementById('newMatchAmount');
  if (!inputEl) {
    alert('Input field not found');
    return;
  }
  
  const newAmount = parseFloat(inputEl.value);
  
  if (isNaN(newAmount) || newAmount < 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  const match = adminState.matches.find(m => m.guid === matchGuid);
  if (!match) {
    alert('Match not found');
    return;
  }
  
  const lendee = adminState.lendees.find(l => l.guid === match.lendeeGuid);
  const lender = adminState.lenders.find(l => l.guid === match.lenderGuid);
  
  if (!lendee || !lender) {
    alert('Lendee or lender not found');
    return;
  }
  
  // Validate new amount
  const lendeeOutstanding = lendee.requestedAmount - lendee.matchedAmount + match.amount; // Add back current match
  const lenderAvailable = lender.loanAmount - lender.usedAmount + match.amount; // Add back current match
  
  if (newAmount > lendeeOutstanding) {
    alert(`Amount exceeds lendee need ($${lendeeOutstanding} available)`);
    return;
  }
  
  if (newAmount > lenderAvailable) {
    alert(`Amount exceeds lender capacity ($${lenderAvailable} available)`);
    return;
  }
  
  try {
    // Show loading state
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    const updateData = {
      type: 'match_update',
      match_guid: matchGuid,
      new_amount: newAmount,
      timestamp: new Date().toISOString()
    };
    
    console.log('Creating match update record:', updateData);
    
    const encryptedChunks = window.snapApp.encryptData(updateData);
    
    const payload = {
      data: {
        type: 'match_update',
        encrypted_chunks: encryptedChunks
      }
    };
    
    const { data, error } = await window.snapApp.supabase
      .from(window.snapApp.TABLE_NAME)
      .insert([payload])
      .select();
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Update record created successfully:', data);
    
    // Re-fetch all data
    await loadAllData();
    
    // Close modal
    closeModal();
    
    // Show success
    alert('Match amount updated successfully. All tables have been refreshed.');
  } catch (error) {
    console.error('Update error:', error);
    alert('Failed to update match amount: ' + error.message);
  }
};

function generateCsv() {
  const headers = ['Lendee Name', 'Lender Name', 'Loan Amount', 'Lendee Contact Info', 'Lender Email', 'Date Created', 'Time Created'];
  const rows = [headers.join(',')];
  
  // Export all matches (using latest amounts)
  for (const match of adminState.matches) {
    const lendee = adminState.lendees.find(l => l.guid === match.lendeeGuid);
    const lender = adminState.lenders.find(l => l.guid === match.lenderGuid);
    
    if (!lendee || !lender) continue;
    
    // Format contact info
    let lendeeContact = '';
    if (lendee.contactMethod === 'email' && lendee.contactInfo.email) {
      lendeeContact = lendee.contactInfo.email;
    } else if (lendee.contactMethod === 'phone' && lendee.contactInfo.phone) {
      lendeeContact = lendee.contactInfo.phone;
    } else if (lendee.contactMethod === 'mail' && lendee.contactInfo.address) {
      lendeeContact = `"${lendee.contactInfo.address.replace(/"/g, '""')}"`;
    }
    
    const timestamp = match.timestamp ? new Date(match.timestamp) : new Date();
    const dateCreated = timestamp.toLocaleDateString();
    const timeCreated = timestamp.toLocaleTimeString();
    
    const row = [
      lendee.firstName,
      lender.firstName,
      match.amount,
      lendeeContact,
      lender.email || '',
      dateCreated,
      timeCreated
    ];
    
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}

function handleExportCsv() {
  try {
    const csv = generateCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snap-matches-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('CSV export error:', error);
    alert('Failed to export CSV: ' + error.message);
  }
}
