// Simple Test Framework
const TestSuite = {
    run: function(name, tests) {
        let passed = 0;
        let failed = 0;
        let html = `<div class="test-suite"><h3>${name}</h3>`;

        for (const testName in tests) {
            try {
                tests[testName]();
                html += `<div class="test-case pass">&#10004; ${testName}</div>`;
                passed++;
            } catch (e) {
                html += `<div class="test-case fail">&#10008; ${testName}<br><pre>${e.stack || e}</pre></div>`;
                failed++;
            }
        }
        html += `</div>`;
        document.getElementById('testResults').innerHTML += html;
        return { passed, failed };
    },
    assertEquals: function(expected, actual, message = 'Assertion failed') {
        const expStr = JSON.stringify(expected);
        const actStr = JSON.stringify(actual);
        if (expStr !== actStr) {
            throw new Error(`${message}: Expected ${expStr}, but got ${actStr}`);
        }
    },
    assertTrue: function(value, message = 'Assertion failed') {
        if (value !== true) {
            throw new Error(`${message}: Expected true, but got ${value}`);
        }
    },
    assertFalse: function(value, message = 'Assertion failed') {
        if (value !== false) {
            throw new Error(`${message}: Expected false, but got ${value}`);
        }
    },
    assertNotNull: function(value, message = 'Assertion failed') {
        if (value === null || value === undefined) {
            throw new Error(`${message}: Expected not null, but got ${value}`);
        }
    }
};

// Global appState mock for tests.
let appState;

// --- Test Suites ---

document.addEventListener('DOMContentLoaded', () => {
    let totalPassed = 0;
    let totalFailed = 0;

    const resetAppStateForValidation = () => {
        // Simulate the structure of appState that validateInput expects
        appState = {
            errors: {}, // validateInput writes here
            // formData is not directly used by validateInput but might be by rules if they were more complex
            formData: {}
        };
    };

    const resetAppStateForCalcDetails = () => {
        // Simulate the structure of appState that calculateImplementationDetails uses
        appState = {
            formData: {
                currentYear: '2024' // Default currentYear for consistent date calculations
            },
            errors: {} // Not used by calculateImplementationDetails but good for consistency
        };
    };

    // Test Suite for: determineCategory
    // No appState reset needed here as determineCategory is pure based on its inputs
    let determineCategoryTs = TestSuite.run("determineCategory", {
        "Category 1: Revenue >5M, <=25M": function() {
            const inputs = { annualRevenue2024: 6000000, annualRevenue2025: 0, businessCommencementYear: 2020, isPreBusiness: false };
            TestSuite.assertEquals({ category: 1, implementationDate: "2025-07-01" }, determineCategory(inputs));
        },
        "Category 2: Revenue >1M, <=5M": function() {
            const inputs = { annualRevenue2024: 2000000, annualRevenue2025: 0, businessCommencementYear: 2020, isPreBusiness: false };
            TestSuite.assertEquals({ category: 2, implementationDate: "2026-01-01" }, determineCategory(inputs));
        },
        "Category 3: Revenue >=500k, <=1M": function() {
            const inputs = { annualRevenue2024: 750000, annualRevenue2025: 0, businessCommencementYear: 2020, isPreBusiness: false };
            TestSuite.assertEquals({ category: 3, implementationDate: "2026-07-01" }, determineCategory(inputs));
        },
        "Category 4: Pre-business >=500k revenue, commencing <2026": function() {
            const inputs = { annualRevenue2024: 0, annualRevenue2025: 600000, businessCommencementYear: 2025, isPreBusiness: true };
            TestSuite.assertEquals({ category: 4, implementationDate: "2026-07-01" }, determineCategory(inputs));
        },
        "Category 5: Pre-business >=500k, commencing 2026": function() {
            const inputs = { annualRevenue2024: 0, annualRevenue2025: 700000, businessCommencementYear: 2026, isPreBusiness: true };
            TestSuite.assertEquals({ category: 5, implementationDate: "2026-07-01" }, determineCategory(inputs));
        },
        "Category 5: Pre-business >=500k, commencing 2027": function() {
            const inputs = { annualRevenue2024: 0, annualRevenue2025: 700000, businessCommencementYear: 2027, isPreBusiness: true };
            TestSuite.assertEquals({ category: 5, implementationDate: "2027-07-01" }, determineCategory(inputs));
        },
        "Category 6: Pre-business <500k revenue, commencing 2025": function() {
            const inputs = { annualRevenue2024: 0, annualRevenue2025: 400000, businessCommencementYear: 2025, isPreBusiness: true };
            TestSuite.assertEquals({ category: 6, implementationDate: "2026-01-01" }, determineCategory(inputs));
        },
        "Default Category 0: Low revenue (established business)": function() {
            const inputs = { annualRevenue2024: 100000, annualRevenue2025: 0, businessCommencementYear: 2020, isPreBusiness: false };
            const result = determineCategory(inputs);
            TestSuite.assertEquals(0, result.category);
            TestSuite.assertNotNull(result.message);
        },
        "Default Category 0: Pre-business, but invalid/unmatched conditions": function() {
            // Example: isPreBusiness true, but annualRevenue2025 is null or NaN, or commencement year is strange
            const inputs = { annualRevenue2024: null, annualRevenue2025: null, businessCommencementYear: 2025, isPreBusiness: true };
            const result = determineCategory(inputs);
            TestSuite.assertEquals(0, result.category);
            TestSuite.assertTrue(result.message.includes("cannot be determined"));
        }
    });
    totalPassed += determineCategoryTs.passed; totalFailed += determineCategoryTs.failed;

    // Test Suite for: calculateImplementationDetails
    resetAppStateForCalcDetails(); // Resets appState.formData.currentYear to '2024'
    let calculateImplementationDetailsTs = TestSuite.run("calculateImplementationDetails", {
        "Valid date, future (currentYear 2024)": function() {
            resetAppStateForCalcDetails(); // Ensure appState.formData.currentYear is '2024'
            const categoryResult = { category: 1, implementationDate: "2025-07-01" }; // July 1, 2025
            const details = calculateImplementationDetails(categoryResult);
            TestSuite.assertEquals("July 1, 2025", details.implementationDate);
            TestSuite.assertTrue(details.daysUntil > 365, `Days until expected >365, got ${details.daysUntil}`); // Approx 1.5 years from Jan 1 2024
            TestSuite.assertEquals(false, details.isOverdue);
            TestSuite.assertEquals("low", details.urgencyLevel);
        },
        "Valid date, past (overdue from 2024)": function() {
            resetAppStateForCalcDetails(); // currentYear '2024'
            const categoryResult = { category: 1, implementationDate: "2023-01-01" }; // Jan 1, 2023
            const details = calculateImplementationDetails(categoryResult);
            TestSuite.assertEquals("January 1, 2023", details.implementationDate);
            TestSuite.assertEquals(0, details.daysUntil);
            TestSuite.assertEquals(true, details.isOverdue);
            TestSuite.assertEquals("overdue", details.urgencyLevel); // Corrected from "high" to "overdue"
        },
        "No implementation date (Category 0)": function() {
            resetAppStateForCalcDetails();
            const categoryResult = { category: 0, implementationDate: null, message: "Test message for Cat 0" };
            const details = calculateImplementationDetails(categoryResult);
            TestSuite.assertEquals("N/A", details.implementationDate);
            TestSuite.assertEquals("N/A", details.daysUntil);
            TestSuite.assertEquals("Test message for Cat 0", details.message);
        },
        "Urgency: High (<90 days from Jan 1, 2024)": function() {
            resetAppStateForCalcDetails(); // currentYear '2024'
            const futureDate = new Date(2024, 0, 1); // Jan 1, 2024
            futureDate.setDate(futureDate.getDate() + 60); // Approx Mar 1, 2024
            const categoryResult = { category: 2, implementationDate: futureDate.toISOString().split('T')[0] };
            const details = calculateImplementationDetails(categoryResult);
            TestSuite.assertEquals("high", details.urgencyLevel);
        },
        "Urgency: Medium (<180 days, >90 days from Jan 1, 2024)": function() {
            resetAppStateForCalcDetails(); // currentYear '2024'
            const futureDate = new Date(2024, 0, 1); // Jan 1, 2024
            futureDate.setDate(futureDate.getDate() + 120); // Approx May 1, 2024
            const categoryResult = { category: 2, implementationDate: futureDate.toISOString().split('T')[0] };
            const details = calculateImplementationDetails(categoryResult);
            TestSuite.assertEquals("medium", details.urgencyLevel);
        },
         "Urgency: Overdue (date is Jan 1, 2024, target is Dec 31, 2023)": function() {
            resetAppStateForCalcDetails(); // currentYear '2024' (calculation from Jan 1st)
            const categoryResult = { category: 1, implementationDate: "2023-12-31" };
            const details = calculateImplementationDetails(categoryResult);
            TestSuite.assertEquals(true, details.isOverdue);
            TestSuite.assertEquals("overdue", details.urgencyLevel);
        }
    });
    totalPassed += calculateImplementationDetailsTs.passed; totalFailed += calculateImplementationDetailsTs.failed;

    // Test Suite for: validateInput
    // This suite relies on `validationRules` being available from script.js
    let validateInputTs = TestSuite.run("validateInput", {
        "annualRevenue2024: valid number": function() {
            resetAppStateForValidation();
            TestSuite.assertTrue(validateInput('annualRevenue2024', '1000000'));
            TestSuite.assertEquals(null, appState.errors.annualRevenue2024);
        },
        "annualRevenue2024: required (empty string)": function() {
            resetAppStateForValidation();
            TestSuite.assertFalse(validateInput('annualRevenue2024', ''));
            TestSuite.assertNotNull(appState.errors.annualRevenue2024);
        },
         "annualRevenue2024: required (null)": function() {
            resetAppStateForValidation();
            TestSuite.assertFalse(validateInput('annualRevenue2024', null));
            TestSuite.assertNotNull(appState.errors.annualRevenue2024);
        },
        "annualRevenue2024: too low (negative)": function() {
            resetAppStateForValidation();
            // The refined validateInput parses to number, so -100 is a number.
            // The rule is min:0, so this should fail.
            TestSuite.assertFalse(validateInput('annualRevenue2024', '-100'));
            TestSuite.assertNotNull(appState.errors.annualRevenue2024);
        },
        "annualRevenue2024: not a number": function() {
            resetAppStateForValidation();
            TestSuite.assertFalse(validateInput('annualRevenue2024', 'abc'));
            TestSuite.assertNotNull(appState.errors.annualRevenue2024);
        },
        "email: valid": function() {
            resetAppStateForValidation();
            TestSuite.assertTrue(validateInput('email', 'test@example.com'));
            TestSuite.assertEquals(null, appState.errors.email);
        },
        "email: invalid format (no TLD)": function() {
            resetAppStateForValidation();
            TestSuite.assertFalse(validateInput('email', 'test@example'));
            TestSuite.assertNotNull(appState.errors.email);
        },
        "email: required (empty string)": function() {
            resetAppStateForValidation();
            TestSuite.assertFalse(validateInput('email', ''));
            TestSuite.assertNotNull(appState.errors.email);
        },
        "Optional field (no rules defined): always true": function() {
            resetAppStateForValidation();
            TestSuite.assertTrue(validateInput('optionalFieldWithoutRules', 'some value'));
            TestSuite.assertEquals(undefined, appState.errors.optionalFieldWithoutRules); // No error stored
        },
        "Optional field (no rules defined): empty string is true": function() {
            resetAppStateForValidation();
            TestSuite.assertTrue(validateInput('optionalFieldWithoutRules', ''));
            TestSuite.assertEquals(undefined, appState.errors.optionalFieldWithoutRules);
        }
    });
    totalPassed += validateInputTs.passed; totalFailed += validateInputTs.failed;

    // Test Suite for: generateResultsContent & generateActionItems
    resetAppStateForCalcDetails(); // For currentYear context if needed by calcImplementationDetails
    let generateResultsContentTs = TestSuite.run("generateResultsContent & generateActionItems", {
        "Category 1 content generation": function() {
            resetAppStateForCalcDetails(); // currentYear '2024'
            const catRes = { category: 1, implementationDate: "2025-07-01" };
            const implDetails = calculateImplementationDetails(catRes); // Uses appState.formData.currentYear
            const content = generateResultsContent(catRes, implDetails);
            TestSuite.assertTrue(content.category.includes("Large Business"));
            TestSuite.assertEquals("July 1, 2025", content.implementationDate);
            TestSuite.assertTrue(content.actionItems.length > 0);
            TestSuite.assertFalse(content.isOverdue);
        },
        "Category 0 content (Not Applicable)": function() {
            resetAppStateForCalcDetails();
            const catRes = { category: 0, message: "Not applicable test message" };
            const implDetails = calculateImplementationDetails(catRes); // Will get N/A results
            const content = generateResultsContent(catRes, implDetails);
            TestSuite.assertEquals("Not Applicable", content.category);
            TestSuite.assertEquals("Not applicable test message", content.message);
            TestSuite.assertTrue(content.actionItems[0].includes("No immediate action"));
        },
        "Action items: High urgency (from generateActionItems)": function() {
            resetAppStateForCalcDetails(); // currentYear '2024'
            const futureDate = new Date(2024, 0, 1); futureDate.setDate(futureDate.getDate() + 60); // ~March 1st
            const implDetails = { // Mocking details that generateActionItems expects
                isOverdue: false,
                urgencyLevel: "high",
                implementationDate: futureDate.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })
            };
            const actions = generateActionItems(2, implDetails); // Category 2
            TestSuite.assertTrue(actions[0].startsWith("PRIORITY:"));
        },
        "Action items: Overdue (from generateActionItems)": function() {
            resetAppStateForCalcDetails(); // currentYear '2024'
            const implDetails = { // Mocking details
                isOverdue: true,
                urgencyLevel: "overdue",
                implementationDate: "January 1, 2023"
            };
            const actions = generateActionItems(1, implDetails); // Category 1
            TestSuite.assertTrue(actions[0].startsWith("URGENT: Implementation date has passed"));
        }
    });
    totalPassed += generateResultsContentTs.passed; totalFailed += generateResultsContentTs.failed;

    // Summary
    let summaryHtml = `<div class="summary">Total Tests: ${totalPassed + totalFailed} | Passed: <span class="pass">${totalPassed}</span> | Failed: <span class="fail">${totalFailed}</span></div>`;
    document.getElementById('testResults').innerHTML += summaryHtml;

    if (totalFailed > 0) {
        console.error(`Unit Test Summary: Passed: ${totalPassed}, Failed: ${totalFailed}`);
    } else {
        console.log(`Unit Test Summary: All ${totalPassed} tests passed!`);
    }
});
