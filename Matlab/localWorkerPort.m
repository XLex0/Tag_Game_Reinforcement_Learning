
% ===== Helper para puerto por worker =====
function [wk, port] = localWorkerPort(basePort)
wk = 0;
t = getCurrentTask();   % vacío si no hay paralelo
if ~isempty(t), wk = t.ID; end
port = basePort + wk;   % p.ej.: 7777 (cliente) / 7778.. para workers
end
