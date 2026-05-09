// ============================================================
// api/create-preference.js
// Vercel Serverless Function — Mercado Pago Checkout Pro
// Credenciais de PRODUÇÃO
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, payer, shipment_cost } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No hay productos' });

    // ============================================================
    // CREDENCIAIS PRODUÇÃO
    // ============================================================
    const ACCESS_TOKEN = 'APP_USR-4213053415946142-042710-2df6a790b2101e8bc26b6a6514344214-3351191200';

    // ============================================================
    // CÁLCULO: comissão 6,60% + IVA 21% sobre a comissão
    // Para o vendedor receber o preço cheio:
    // preco_cobrar = preco / (1 - 0.066 * 1.21)
    // Fator = 1 / (1 - 0.066 * 1.21) = 1 / 0.92014 ≈ 1.08679
    // ============================================================
    const MP_FACTOR = 1 / (1 - 0.066 * 1.21); // ~1.08679

    const mpItems = items.map(item => ({
      id: item.id || 'product',
      title: item.name,
      quantity: Number(item.qty),
      unit_price: Math.round(item.price * MP_FACTOR), // preço ajustado
      currency_id: 'ARS',
      category_id: 'others',
      picture_url: item.image || undefined,
    }));

    // Frete com ajuste também
    if (shipment_cost && shipment_cost > 0) {
      mpItems.push({
        id: 'envio',
        title: 'Envío - Correo Argentino',
        quantity: 1,
        unit_price: Math.round(shipment_cost * MP_FACTOR),
        currency_id: 'ARS',
        category_id: 'services',
      });
    }

    const preference = {
      items: mpItems,
      payer: payer ? {
        name: payer.name || '',
        phone: payer.phone ? { number: payer.phone } : undefined,
      } : undefined,
      back_urls: {
        success: 'https://www.zoeveos.com/?mp=success',
        failure: 'https://www.zoeveos.com/?mp=failure',
        pending: 'https://www.zoeveos.com/?mp=pending',
      },
      auto_return: 'approved',
      statement_descriptor: 'ZOE VEOS',
      external_reference: `ZOEVEOS-${Date.now()}`,
      payment_methods: {
        installments: 12,
      },
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `zoeveos-${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('MP Error:', data);
      return res.status(response.status).json({ error: data.message || 'Error en Mercado Pago' });
    }

    return res.status(200).json({
      init_point: data.init_point, // produção
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
