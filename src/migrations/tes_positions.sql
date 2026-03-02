-- Migration: TES positions portfolio
-- Run this in Supabase Dashboard > SQL Editor (schema: xerenity)
-- Date: 2026-03

-- ── Tabla ──

CREATE TABLE IF NOT EXISTS xerenity.tes_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      TEXT,

  -- Identidad del bono (del catálogo pysdk)
  bond_name       TEXT NOT NULL,
  issue_date      DATE NOT NULL,
  maturity_date   DATE NOT NULL,
  coupon_rate     DECIMAL(8,6) NOT NULL,      -- decimal e.g. 0.07 = 7%
  face_value      DECIMAL(18,2) NOT NULL DEFAULT 100,

  -- Posición
  notional        DECIMAL(18,2) NOT NULL,     -- COP total (unidades * face_value)
  purchase_price  DECIMAL(10,6),              -- precio limpio de entrada (opcional)
  purchase_ytm    DECIMAL(8,6),               -- YTM de entrada en decimal (opcional)

  -- Operacional
  trade_date      DATE,
  sociedad        TEXT,
  estado          TEXT DEFAULT 'Activo',
  label           TEXT,
  counterparty    TEXT,                       -- custodio / broker

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ──

ALTER TABLE xerenity.tes_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tes_own" ON xerenity.tes_positions;
CREATE POLICY "tes_own" ON xerenity.tes_positions
  FOR ALL USING (auth.uid() = owner);

-- ── RPC: fetch ──

CREATE OR REPLACE FUNCTION xerenity.get_tes_positions()
RETURNS SETOF xerenity.tes_positions
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM xerenity.tes_positions
  WHERE owner = auth.uid()
  ORDER BY created_at DESC;
$$;

-- ── RPC: create ──

CREATE OR REPLACE FUNCTION xerenity.create_tes_position(
  p_bond_name       TEXT,
  p_issue_date      DATE,
  p_maturity_date   DATE,
  p_coupon_rate     DECIMAL,
  p_notional        DECIMAL,
  p_face_value      DECIMAL  DEFAULT 100,
  p_purchase_price  DECIMAL  DEFAULT NULL,
  p_purchase_ytm    DECIMAL  DEFAULT NULL,
  p_trade_date      DATE     DEFAULT NULL,
  p_sociedad        TEXT     DEFAULT NULL,
  p_estado          TEXT     DEFAULT 'Activo',
  p_label           TEXT     DEFAULT NULL,
  p_counterparty    TEXT     DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO xerenity.tes_positions (
    owner, bond_name, issue_date, maturity_date, coupon_rate,
    notional, face_value, purchase_price, purchase_ytm,
    trade_date, sociedad, estado, label, counterparty
  ) VALUES (
    auth.uid(), p_bond_name, p_issue_date, p_maturity_date, p_coupon_rate,
    p_notional, p_face_value, p_purchase_price, p_purchase_ytm,
    p_trade_date, p_sociedad, p_estado, p_label, p_counterparty
  )
  RETURNING id INTO new_id;

  RETURN json_build_object('message', 'TES position created', 'id', new_id);
END;
$$;

-- ── RPC: delete ──

CREATE OR REPLACE FUNCTION xerenity.delete_tes_position(position_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM xerenity.tes_positions
  WHERE id = ANY(position_ids) AND owner = auth.uid();

  RETURN json_build_object('message', 'Deleted');
END;
$$;
