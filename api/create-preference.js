// ============================================================
// api/create-preference.js
// Vercel Serverless Function — Mercado Pago Checkout Pro
// ============================================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, payer, shipment_cost, coupon_code, discount } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No hay productos en el carrito' });
    }

    // ACCESS TOKEN — modo TEST
    const ACCESS_TOKEN = 'TEST-5261677571482638-082910-6e1244204d64cbe13c7ebe577f117dde-2499743056';

    // Construir items para MP
    const mpItems = items.map(item => ({
      id: item.id || 'product',
      title: item.name,
      quantity: item.qty,
      unit_price: Number(item.price),
      currency_id: 'ARS',
      category_id: 'others',
      picture_url: item.image || undefined,
    }));

    // Agregar flete como item si hay costo
    if (shipment_cost && shipment_cost > 0) {
      mpItems.push({
        id: 'envio',
        title: 'Envío - Correo Argentino',
        quantity: 1,
        unit_price: Number(shipment_cost),
        currency_id: 'ARS',
        category_id: 'services',
      });
    }

    // Descuento como item negativo si hay
    if (discount && discount > 0) {
      mpItems.push({
        id: 'descuento',
        title: coupon_code ? `Descuento cupón ${coupon_code}` : 'Descuento promoción',
        quantity: 1,
        unit_price: -Number(discount),
        currency_id: 'ARS',
        category_id: 'others',
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
      expires: false,
      payment_methods: {
        excluded_payment_types: [],
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
      id: data.id,
      init_point: data.init_point,         // producción
      sandbox_init_point: data.sandbox_init_point, // test
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
