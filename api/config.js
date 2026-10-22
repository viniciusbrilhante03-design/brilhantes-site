// Entrega ao navegador o endereço do banco e a chave pública (anon/publishable). Nunca a chave secreta.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({url: process.env.SUPABASE_URL || "", anon: process.env.SUPABASE_ANON_KEY || ""});
};
