-- Doses guardadas só com o número ("2,5") passam a ter a unidade ("2,5 mg"); "5mg" vira "5 mg".
update applications set dose_texto = replace(dose_texto, '.', ',') || ' mg' where dose_texto ~ '^\s*\d+([.,]\d+)?\s*$';
update applications set dose_texto = regexp_replace(replace(dose_texto, '.', ','), '^\s*(\d+(,\d+)?)\s*mg\s*$', '\1 mg', 'i') where dose_texto ~* '^\s*\d+([.,]\d+)?\s*mg\s*$';
update prescriptions set dose_texto = replace(dose_texto, '.', ',') || ' mg' where dose_texto ~ '^\s*\d+([.,]\d+)?\s*$';
update prescriptions set dose_texto = regexp_replace(replace(dose_texto, '.', ','), '^\s*(\d+(,\d+)?)\s*mg\s*$', '\1 mg', 'i') where dose_texto ~* '^\s*\d+([.,]\d+)?\s*mg\s*$';
