async function test() {
    const res = await fetch('https://rmkgroups.in/rmk-sync-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rmk_test', value: '123' })
    });
    console.log(res.status);
    console.log(await res.text());
}
test();
