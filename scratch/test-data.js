async function test() {
    const res = await fetch('https://rmkgroups.in/rmk-cloud-sync');
    const data = await res.json();
    console.log(Object.keys(data));
    if (data.rmk_invoices) {
        console.log("Invoices array length:", JSON.parse(data.rmk_invoices).length);
        console.log("First invoice:", JSON.parse(data.rmk_invoices)[0].invNumber);
    } else {
        console.log("rmk_invoices NOT FOUND");
    }
}
test();
