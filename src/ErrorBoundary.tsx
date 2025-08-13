// παράδειγμα σε hook ή component που φορτώνει τα data (π.χ. use-presale / Index)
const [err, setErr] = useState<string | null>(null);
const [status, setStatus] = useState<any>(null);

useEffect(() => {
  (async () => {
    try {
      const s = await j("/status");
      setStatus(s);
    } catch (e) {
      console.error("[PRESALE STATUS FAIL]", e);
      setErr((e as Error).message);
    }
  })();
}, []);

if (err) return <div style={{padding:16,color:"#c00"}}>API error: {err}</div>;
if (!status) return <div>Loading presale…</div>;
