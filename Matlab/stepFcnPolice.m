function [obs, reward, done, loggedSignals] = stepFcnPolice(action, loggedSignals)
persistent tc w r
addr = '127.0.0.1';
port = 7777;

% (re)usar la misma conexión
if isempty(tc) || ~isvalid(tc)
    tc = tcpclient(addr, port, 'Timeout', 30);
    configureTerminator(tc,"LF");
    w  = @(s) writeline(tc, jsonencode(s));
    r  = @() jsondecode(char(readline(tc)));
end

% ---- Parseo de acción (1x4) ----
if iscell(action), a = double(action{1}(:)).';
else,               a = double(action(:)).';
end
aP0 = a(1,1:2);
aP1 = a(1,3:4);
aT  = [0 0];  % ladrón fijo (o tu policy)

% ===== Shaping: penalizar intento de entrar a MURO =====
wallsRC  = loggedSignals.wallsRC;     % Nx2 [row col], 1-based
gridSize = loggedSignals.gridSize;    % escalar (G)
wallPenalty = 0;

% Estado previo (antes del paso), en unidades del simulador (0-based continuas)
lastObsSim = loggedSignals.lastObs;   % [tx; ty; p0x; p0y; p1x; p1y] en SIM units
tx_prev  = lastObsSim(1); ty_prev  = lastObsSim(2);
p0x_prev = lastObsSim(3); p0y_prev = lastObsSim(4);
p1x_prev = lastObsSim(5); p1y_prev = lastObsSim(6);

% Destinos INTENTADOS en coords del sim (0-based continuas)
p0x_try = p0x_prev + aP0(1);  p0y_try = p0y_prev + aP0(2);
p1x_try = p1x_prev + aP1(1);  p1y_try = p1y_prev + aP1(2);

% Pasar a celdas 1-based (redondeo + 1) y acotar a [1..G]
G = gridSize;
p0_cell = [ min(max(round(p0y_try)+1,1), G), min(max(round(p0x_try)+1,1), G) ];
p1_cell = [ min(max(round(p1y_try)+1,1), G), min(max(round(p1x_try)+1,1), G) ];

if ~isempty(wallsRC)
    if ismember(p0_cell, wallsRC, 'rows'), wallPenalty = wallPenalty - 0.05; end
    if ismember(p1_cell, wallsRC, 'rows'), wallPenalty = wallPenalty - 0.05; end
end
% ===== fin shaping muros =====

% ---- Paso del simulador vía TCP ----
w(struct('cmd','step','aThief',aT,'aP0',aP0,'aP1',aP1,'n',12,'dt',0.02));
C = r();

% ---- Terminación y recompensa (policías) ----
tmax = 35;
done = logical(C.info.captured || C.info.t >= tmax);

% Base: +1 por captura, -0.001 por paso vivo, + wallPenalty
reward = double(C.info.captured) - double(~done)*0.001 + wallPenalty;

% ===== DISTANCIA: shaping por acercamiento promedio =====
% (usamos G del sim por si cambió)
G = double(C.info.gridSize);

% Distancias previas (normalizadas)
d0_prev = hypot(p0x_prev - tx_prev, p0y_prev - ty_prev);
d1_prev = hypot(p1x_prev - tx_prev, p1y_prev - ty_prev);
d0_prev_s = d0_prev / (sqrt(2)*G);
d1_prev_s = d1_prev / (sqrt(2)*G);
d_prev_avg = 0.5*(d0_prev_s + d1_prev_s);

% Distancias actuales (normalizadas)
tx = C.obs.thief(1); ty = C.obs.thief(2);
p0x = C.obs.p0(1);   p0y = C.obs.p0(2);
p1x = C.obs.p1(1);   p1y = C.obs.p1(2);
d0 = hypot(p0x - tx, p0y - ty);
d1 = hypot(p1x - tx, p1y - ty);
d0_s = d0 / (sqrt(2)*G);
d1_s = d1 / (sqrt(2)*G);
d_curr_avg = 0.5*(d0_s + d1_s);

% Delta positivo = se acercaron; negativo = se alejaron
delta_avg = d_prev_avg - d_curr_avg;

% Peso y clip por paso
kDist = 0.25;                       % antes 0.25 — empuja más el acercamiento
delta_clipped = max(min(delta_avg, 0.2), -0.2);
reward = reward + kDist * delta_clipped;
% ===== fin DISTANCIA =====

% ===== Anti-stall: penaliza quedarse quieto =====
m0 = hypot(p0x - p0x_prev, p0y - p0y_prev);
m1 = hypot(p1x - p1x_prev, p1y - p1y_prev);
stall_eps = 1e-3;      % umbral chico en unidades del sim
stall_pen = 0.02;      % penalización suave por agente
if m0 < stall_eps, reward = reward - stall_pen; end
if m1 < stall_eps, reward = reward - stall_pen; end
% ===== fin Anti-stall =====

% Bonus extra por captura (además del +1 base)
if C.info.captured
    rCaptureBonus = 2.0;   % probar 1–5
    reward = reward + rCaptureBonus;
end

% Penalización terminal por timeout (si no capturaron)
if ~C.info.captured && C.info.t >= tmax
    reward = reward - 1.5;   % antes -1.0
end

% ---- Observación (+ distancias d0,d1), luego ESCALAR para la red ----
tx_s  = tx  / G; ty_s  = ty  / G;
p0x_s = p0x / G; p0y_s = p0y / G;
p1x_s = p1x / G; p1y_s = p1y / G;
d0_s  = d0  / (sqrt(2)*G);
d1_s  = d1  / (sqrt(2)*G);

v   = [tx_s, ty_s, p0x_s, p0y_s, p1x_s, p1y_s, d0_s, d1_s];  % 1x8 escalado
obs = reshape(double(v), [8,1]);

% Guardar lastObs en SIM units (no escaladas) para el shaping del próximo step
loggedSignals.lastObs = reshape(double([tx, ty, p0x, p0y, p1x, p1y]), [6,1]);
end
