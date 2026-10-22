// Entrega ao navegador o endereço do banco e a chave pública (anon/publishable). Nunca a chave secreta. (A chave do Google Maps é pública por natureza: fica protegida pela restrição de domínio no Google Cloud.)
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({url: process.env.SUPABASE_URL || "", anon: process.env.SUPABASE_ANON_KEY || "", gmaps: process.env.GOOGLE_MAPS_API_KEY || ""});
};
