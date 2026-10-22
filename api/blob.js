// /_blob/<id> -> arquivo guardado no Supabase Storage (pasta "arquivos").
const {URL_} = require("./_lib");
module.exports = (req, res) => {
  const id = String((req.query && req.query.id) || "");
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(id) || !URL_()) return res.status(404).send("Arquivo não encontrado");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.redirect(302, `${URL_()}/storage/v1/object/public/arquivos/${id}`);
};
