-- Migration: Add drug_licence_no and gstin to branches table
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS drug_licence_no text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS gstin text;

-- Add comments for documentation
COMMENT ON COLUMN public.branches.drug_licence_no IS 'Pharmacy branch drug licence number (e.g. Form 20B/21B)';
COMMENT ON COLUMN public.branches.gstin IS 'Pharmacy branch GST Identification Number';
