// widget main script. scaffold only. no data wiring in this issue.
// TODOs below describe what later issues will fill in.

document.addEventListener('DOMContentLoaded', () => {

  const lookupForm = document.getElementById('lookup-form');
  const opaIdInput = document.getElementById('opa-id-input');

  // prevent default submit so the page doesnt reload during dev
  // real lookup logic comes in a later issue
  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // TODO: validate opa id format (9 or 10 digits)
    // TODO: fetch property data from the backend or gcs public bucket
    // TODO: update #property-address, #property-city-zip, #meta-opa-id,
    //       #meta-tax-balance, #meta-record-count, #valuation-chart,
    //       and #valuation-table-body with the results
    console.log('lookup submitted for opa id:', opaIdInput.value);
  });

});
