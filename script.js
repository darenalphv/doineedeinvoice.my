const initialState = {
  currentStep: 1, // Start at step 1
  formData: {
    annualRevenue2024: null,
    annualRevenue2025: null,
    businessCommencementYear: '2024', // Default value
    isPreBusiness: false,
    currentYear: '2024', // Default value
    // Newsletter fields
    email: '',
    businessName: '',
    phone: '',
    marketingConsent: false
  },
  results: null,
  errors: {},
  isLoading: false // Not used yet, but good to have
};

// Make a copy of initial state to work with
let appState = JSON.parse(JSON.stringify(initialState));

const questionFlow = [
  { id: 'step1', title: 'Annual Revenue' },
  { id: 'step2', title: 'Business Information' },
  { id: 'step3', title: 'Your E-Invoice Requirements' },
  { id: 'step4', title: 'Stay Updated' }
];

const validationRules = {
  annualRevenue2024: { required: true, min: 0, max: 1000000000, type: 'number' },
  annualRevenue2025: { required: true, min: 0, max: 1000000000, type: 'number' }, // Assuming similar rules for 2025
  businessCommencementYear: { required: true, min: 2020, max: 2030, type: 'number' }, // Max adjusted as per issue doc example
  currentYear: { required: true, min: 2022, max: 2026, type: 'number'},
  email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
};

// Refined validateInput function
function validateInput(name, value) {
  const rules = validationRules[name];
  appState.errors[name] = null; // Clear previous error for this specific field

  if (!rules) return true; // No rules for this input

  // Handle required fields
  if (rules.required) {
    if (value === null || value === '' || String(value).trim() === '') {
      appState.errors[name] = 'This field is required.';
      return false;
    }
  } else {
    // For optional fields, if they are empty, they are valid
    if (value === null || value === '' || String(value).trim() === '') {
      return true;
    }
  }

  // Type-specific validation
  if (rules.type === 'number') {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      // If it's required or if it's not empty (meaning user typed something non-numeric)
      if (rules.required || String(value).trim() !== '') {
        appState.errors[name] = 'Please enter a valid number.';
        return false;
      }
    } else { // It is a number, check min/max
      if (rules.min !== undefined && numValue < rules.min) {
        appState.errors[name] = `Value must be ${rules.min} or more.`;
        return false;
      }
      if (rules.max !== undefined && numValue > rules.max) {
        appState.errors[name] = `Value must be ${rules.max} or less.`;
        return false;
      }
    }
  }

  // Pattern validation
  if (rules.pattern) {
    // Only validate pattern if the field is not empty
    if (String(value).trim() !== '' && !rules.pattern.test(value)) {
        appState.errors[name] = 'Invalid format.';
        return false;
    }
  }
  return true;
}

function determineCategory(inputs) {
  const { annualRevenue2024, annualRevenue2025, businessCommencementYear, isPreBusiness } = inputs;

  const rev2024 = parseFloat(annualRevenue2024);
  const rev2025 = parseFloat(annualRevenue2025);
  const commencementYear = parseInt(businessCommencementYear);

  if (isPreBusiness) { // Handle pre-business categories first
    // Category 4: Pre-business commencing before 2026, with projected first year revenue >= RM500k
    if (commencementYear < 2026 && rev2025 >= 500000) {
      return { category: 4, implementationDate: "2026-07-01" };
    }
    // Category 5: Pre-business commencing 2026 or later, with projected first year revenue >= RM500k
    if (commencementYear >= 2026 && rev2025 >= 500000) {
      return {
        category: 5,
        implementationDate: `${commencementYear}-07-01`
      };
    }
    // Category 6: Pre-business with projected first year revenue < RM500k
    if (rev2025 < 500000) {
      const secondYear = commencementYear + 1;
      return {
        category: 6,
        implementationDate: `${secondYear}-01-01`
      };
    }
  } else { // Handle established business categories
    // Category 1: > RM5mil, ≤ RM25mil annual revenue in 2024
    if (rev2024 > 5000000 && rev2024 <= 25000000) {
      return { category: 1, implementationDate: "2025-07-01" };
    }
    // Category 2: > RM1mil, ≤ RM5mil annual revenue in 2024
    if (rev2024 > 1000000 && rev2024 <= 5000000) {
      return { category: 2, implementationDate: "2026-01-01" };
    }
    // Category 3: ≥ RM500k, ≤ RM1mil annual revenue in 2024
    if (rev2024 >= 500000 && rev2024 <= 1000000) {
      return { category: 3, implementationDate: "2026-07-01" };
    }
    // Default for established businesses not meeting criteria for Cat 1, 2, 3 (e.g., < RM500k revenue)
    if (isNaN(rev2024) || rev2024 < 500000) {
      return { category: 0, implementationDate: null, message: "E-invoice not required based on current revenue (below RM500k) or information provided." };
    }
  }

  // Fallback default if none of the above conditions are met
  return { category: 0, implementationDate: null, message: "E-invoice requirements cannot be determined with the provided information." };
}

function calculateImplementationDetails(categoryResult) {
  if (!categoryResult || !categoryResult.implementationDate) {
    return {
        message: categoryResult.message || "Implementation details not applicable.",
        implementationDate: "N/A",
        daysUntil: "N/A",
        isOverdue: false,
        urgencyLevel: "low"
    };
  }

  const { implementationDate } = categoryResult;
  const currentYearForCalc = parseInt(appState.formData.currentYear) || new Date().getFullYear();
  const today = new Date(currentYearForCalc, 0, 1); // Month is 0-indexed (0 for January)

  let targetDate;
  // Check if implementationDate is already a full date string or needs year prefix
  if (implementationDate.includes('-')) { // Assuming YYYY-MM-DD or similar
      targetDate = new Date(implementationDate);
  } else { // Assuming MM-DD format, needs year (this case might not be hit with current logic)
      targetDate = new Date(`${currentYearForCalc}-${implementationDate}`);
  }

  if (isNaN(targetDate.getTime())) {
    console.error("Invalid target date calculated:", implementationDate);
    return {
        message: "Invalid implementation date configured.",
        implementationDate: "N/A",
        daysUntil: "N/A",
        isOverdue: false,
        urgencyLevel: "low"
    };
  }

  const daysUntil = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

  return {
    implementationDate: targetDate.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }),
    daysUntil: daysUntil >= 0 ? daysUntil : 0, // Show 0 if past, don't show negative
    isOverdue: daysUntil < 0,
    urgencyLevel: daysUntil <= 0 ? 'overdue' : daysUntil <= 90 ? 'high' : daysUntil <= 180 ? 'medium' : 'low'
  };
}

function generateResultsContent(categoryResult, implementationDetails) {
  if (categoryResult.category === 0) {
    return {
        category: "Not Applicable",
        message: categoryResult.message,
        implementationDate: "N/A",
        daysUntil: "N/A",
        urgencyLevel: "low", // Default for non-applicable
        actionItems: ["No immediate action required based on current information."],
        isOverdue: false
    };
  }

  const categoryDescriptions = {
    1: "Large Business (>RM5mil, ≤RM25mil annual revenue in 2024)",
    2: "Medium Business (>RM1mil, ≤RM5mil annual revenue in 2024)",
    3: "Small Business (RM500k-RM1mil annual revenue in 2024)",
    4: "Pre-commencement Business (commencing before 2026, ≥RM500k projected first year revenue)",
    5: "New Business (commencing 2026+, ≥RM500k projected first year revenue)",
    6: "New Business (any commencement, <RM500k projected first year revenue)"
  };

  return {
    category: categoryDescriptions[categoryResult.category] || "Unknown Category",
    implementationDate: implementationDetails.implementationDate,
    daysUntil: implementationDetails.daysUntil,
    urgencyLevel: implementationDetails.urgencyLevel,
    actionItems: generateActionItems(categoryResult.category, implementationDetails),
    isOverdue: implementationDetails.isOverdue
  };
}

function generateActionItems(category, implementationDetails) {
  const baseActions = [
    "Familiarize yourself with the e-Invoice guidelines on the MyInvois portal.",
    "Assess your current accounting system's compatibility for API integration.",
    "Plan for staff training on new e-invoice procedures.",
    "Prepare for testing e-invoice generation and submission."
  ];

  if (implementationDetails.isOverdue) {
     return ["URGENT: Implementation date has passed. Please check requirements immediately.", ...baseActions];
  }
  if (implementationDetails.urgencyLevel === 'high') {
    return ["PRIORITY: Your implementation date is approaching soon. " + baseActions[0], ...baseActions.slice(1)];
  }
  if (implementationDetails.urgencyLevel === 'medium') {
    return ["ACTION: Your implementation date is within the next 6 months. " + baseActions[0], ...baseActions.slice(1)];
  }

  return baseActions;
}

function populateDropdowns() {
  const businessCommencementYearInput = document.getElementById('businessCommencementYear');
  const currentYearInput = document.getElementById('currentYear');

  if(businessCommencementYearInput && currentYearInput) {
    // Clear existing options first to prevent duplication if called multiple times
    businessCommencementYearInput.innerHTML = '';
    currentYearInput.innerHTML = '';

    for (let year = 2020; year <= 2026; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      businessCommencementYearInput.appendChild(option.cloneNode(true)); // Use cloneNode for safety if appending same option object
    }
    businessCommencementYearInput.value = appState.formData.businessCommencementYear;

    for (let year = 2022; year <= 2026; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      currentYearInput.appendChild(option.cloneNode(true));
    }
    currentYearInput.value = appState.formData.currentYear;
  } else {
    console.error("Dropdown elements not found for population.");
  }
}

function updateStepVisibility() {
  const stepsElements = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
    document.getElementById('step4')
  ];
  const progressIndicator = document.getElementById('progressIndicator');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');

  if (!progressIndicator || !prevButton || !nextButton) {
    console.error("Navigation or progress indicator elements not found.");
    return;
  }

  stepsElements.forEach((stepEl, index) => {
    if(stepEl) {
      stepEl.style.display = (index === appState.currentStep - 1) ? 'block' : 'none';
    } else {
      console.warn(`Step element for step ${index + 1} not found.`);
    }
  });

  progressIndicator.textContent = `Step ${appState.currentStep} / ${stepsElements.length}`;
  prevButton.style.display = appState.currentStep === 1 ? 'none' : 'inline-block';

  if (appState.currentStep === stepsElements.length) { // Last step (newsletter)
    nextButton.style.display = 'none';
  } else {
    nextButton.style.display = 'inline-block';
    nextButton.textContent = appState.currentStep === (stepsElements.length -1) ? 'Go to Newsletter' : 'Next'; // step 3 is results, then newsletter
  }
}

function displayError(inputId, message) {
  let errorElement = document.getElementById(inputId + 'Error');
  const inputElement = document.getElementById(inputId);

  if (!inputElement) {
    // console.warn(`Input element ${inputId} not found for error display.`);
    return;
  }

  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.id = inputId + 'Error';
    errorElement.className = 'error-message';
    errorElement.style.color = 'red';
    errorElement.style.fontSize = '0.9em';
    errorElement.style.marginTop = '4px';
    if (inputElement.parentNode) {
        // Insert after the input, or after its label if the label is next
        inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling ? inputElement.nextSibling.nextSibling : null);
    }
  }
  errorElement.textContent = message || '';
  errorElement.style.display = message ? 'block' : 'none';
}

function clearAllErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
    // Also reset errors in appState for all known validated fields
    Object.keys(validationRules).forEach(fieldName => {
        appState.errors[fieldName] = null;
    });
    appState.errors.email = null; // Ensure newsletter email error is also cleared in state
}

function displayResults(resultsData) {
  const resultsDisplay = document.getElementById('resultsDisplay');
  if (!resultsDisplay) {
      console.error("Results display element not found.");
      return;
  }

  if (!resultsData) {
    resultsDisplay.innerHTML = '<p>Could not calculate results. Please ensure all previous steps are completed correctly.</p>';
    return;
  }

  let content = '<h3>Your E-Invoice Implementation Details</h3>';
  if (resultsData.message) { // This is typically the message for Category 0 or errors
    content += `<p><strong>Status:</strong> ${resultsData.message}</p>`;
  }
  content += `<p><strong>Category:</strong> ${resultsData.category || 'N/A'}</p>`;

  if (resultsData.implementationDate && resultsData.implementationDate !== 'N/A') {
      content += `<p><strong>Implementation Date:</strong> ${resultsData.implementationDate}</p>`;
  }

  if (resultsData.daysUntil !== 'N/A' && resultsData.daysUntil !== undefined) {
    if (resultsData.isOverdue) {
        content += `<p style="color:red;"><strong>Status: OVERDUE (Implementation was due ${Math.abs(resultsData.daysUntil)} days ago)</strong></p>`;
    } else {
        content += `<p><strong>Days Until Implementation:</strong> ${resultsData.daysUntil} (Urgency: <span style="text-transform: capitalize;">${resultsData.urgencyLevel || 'low'}</span>)</p>`;
    }
  }

  if (resultsData.actionItems && resultsData.actionItems.length > 0) {
    content += '<h4>Recommended Actions:</h4><ul>';
    resultsData.actionItems.forEach(item => {
      content += `<li>${item}</li>`;
    });
    content += '</ul>';
  }
  resultsDisplay.innerHTML = content;
}

function addEventListeners() {
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const submitNewsletterButton = document.getElementById('submitNewsletterButton');

  function setupInputListener(inputId, formDataKey, isCheckbox = false, isNumber = false) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) {
        // console.warn(`Input element ${inputId} not found for event listener setup.`);
        return;
    }
    inputElement.addEventListener('change', (e) => {
      let value = isCheckbox ? e.target.checked : e.target.value;
      if(isNumber && !isCheckbox && value !== '') { // Do not parse if empty string, let validation handle "required"
          value = parseFloat(value);
          if(isNaN(value)) value = e.target.value; // If parse fails, keep original string for validation display
      } else if (isNumber && value === '') {
          value = null; // Treat empty number field as null in formData
      }

      appState.formData[formDataKey] = value;

      // Validate on change and display error
      if(validateInput(formDataKey, value)) {
          displayError(inputId, ''); // Clear error if valid
      } else {
          displayError(inputId, appState.errors[formDataKey]); // Show error if invalid
      }
    });
  }

  setupInputListener('annualRevenue2024', 'annualRevenue2024', false, true);
  setupInputListener('annualRevenue2025', 'annualRevenue2025', false, true);
  setupInputListener('businessCommencementYear', 'businessCommencementYear');
  setupInputListener('isPreBusiness', 'isPreBusiness', true);
  setupInputListener('currentYear', 'currentYear');
  setupInputListener('newsletterEmail', 'email'); // Email uses default string handling

  const newsletterBusinessNameInput = document.getElementById('newsletterBusinessName');
  if(newsletterBusinessNameInput) newsletterBusinessNameInput.addEventListener('change', (e) => appState.formData.businessName = e.target.value);
  const newsletterPhoneInput = document.getElementById('newsletterPhone');
  if(newsletterPhoneInput) newsletterPhoneInput.addEventListener('change', (e) => appState.formData.phone = e.target.value);
  const marketingConsentInput = document.getElementById('marketingConsent');
  if(marketingConsentInput) marketingConsentInput.addEventListener('change', (e) => appState.formData.marketingConsent = e.target.checked);


  if(prevButton) {
    prevButton.addEventListener('click', () => {
      if (appState.currentStep > 1) {
        appState.currentStep--;
        updateStepVisibility();
      }
    });
  }

  if(nextButton) {
    nextButton.addEventListener('click', () => {
      clearAllErrors(); // Clear previous errors before validating current step
      let isValid = true;
      const currentStepId = questionFlow[appState.currentStep - 1].id;

      if (currentStepId === 'step1') {
        if (!validateInput('annualRevenue2024', appState.formData.annualRevenue2024)) isValid = false;
        displayError('annualRevenue2024', appState.errors.annualRevenue2024);
        if (!validateInput('annualRevenue2025', appState.formData.annualRevenue2025)) isValid = false;
        displayError('annualRevenue2025', appState.errors.annualRevenue2025);
      } else if (currentStepId === 'step2') {
        if (!validateInput('businessCommencementYear', appState.formData.businessCommencementYear)) isValid = false;
        displayError('businessCommencementYear', appState.errors.businessCommencementYear);
        if (!validateInput('currentYear', appState.formData.currentYear)) isValid = false;
        displayError('currentYear', appState.errors.currentYear);
        // isPreBusiness is a checkbox, its value is always "valid" in terms of format
      }

      if (isValid) {
        // If moving from Step 2 to Step 3 (Results), calculate and display results
        if (currentStepId === 'step2') {
          const categoryResult = determineCategory(appState.formData);
          const implementationDetails = calculateImplementationDetails(categoryResult);
          appState.results = generateResultsContent(categoryResult, implementationDetails); // Store final displayable results
          displayResults(appState.results);
        }

        if (appState.currentStep < questionFlow.length) {
          appState.currentStep++;
          updateStepVisibility();
        }
      }
    });
  }

  if(submitNewsletterButton) {
    submitNewsletterButton.addEventListener('click', () => {
      clearAllErrors(); // Clear previous errors
      let isNewsletterValid = true;
      if (!validateInput('email', appState.formData.email)) {
        isNewsletterValid = false;
        displayError('newsletterEmail', appState.errors.email);
      }
      // Optional: Add validation for other newsletter fields if they become required
      // e.g. marketingConsent for certain regions (not required by current problem spec)

      if (isNewsletterValid) {
        console.log('Newsletter Signup Attempt:', {
          email: appState.formData.email,
          businessName: appState.formData.businessName,
          phone: appState.formData.phone,
          marketingConsent: appState.formData.marketingConsent
        });

        const step4Div = document.getElementById('step4');
        if(step4Div) {
            step4Div.innerHTML = '<h2>Thank You!</h2><p>You have successfully subscribed to the newsletter.</p>';
        }
      }
    });
  }
}

// DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed. Initializing questionnaire.");
  populateDropdowns(); // Set up year dropdowns
  addEventListeners();   // Add event listeners for inputs and buttons
  updateStepVisibility(); // Show the initial step
});
