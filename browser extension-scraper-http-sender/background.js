chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectTestCaseScript,
  });
});

function injectTestCaseScript() {
  const elements = document.querySelectorAll('[data-layout-path="/c1/ts1/t0"]');
  if (elements.length > 0) {
    const testcasesButtonsArray = Array.from(
      elements[0].childNodes[0].childNodes[0].childNodes[0].childNodes[0]
        .childNodes[0].childNodes[0].childNodes
    );
    testcasesButtonsArray.pop();

    let allTestCases = [];
    let processedCases = 0;

    const processTestCase = () => {
      if (processedCases >= testcasesButtonsArray.length) {
        // All test cases collected, send to server
        fetch('http://localhost:3000/testcases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            id: 'testcase-set',
            testCases: allTestCases.map(tc => tc.replace(/,/g, '')) // Remove commas
          }),
        })
          .then(response => response.json())
          .then(data => console.log('Data sent successfully:', data))
          .catch(error => console.error('Error sending data:', error));
        return;
      }

      const testcases =
        elements[0].childNodes[0].childNodes[0].childNodes[0].childNodes[0]
          .childNodes[1];

      // Extract values and join with space, removing any commas
      const values = Array.from(testcases.childNodes)
        .map(testcase => testcase.childNodes[0].childNodes[1].childNodes[0].innerHTML.trim())
        .join(' ')
        .replace(/,/g, '');

      allTestCases.push(values);
      processedCases++;

      // Click next button if available
      if (processedCases < testcasesButtonsArray.length) {
        testcasesButtonsArray[processedCases].click();
        setTimeout(processTestCase, 500);
      } else {
        processTestCase();
      }
    };

    // Start processing
    processTestCase();
  } else {
    console.error("No elements found with the specified data-layout-path.");
  }
}