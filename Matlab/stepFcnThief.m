function [obs, reward, done, loggedSignals] = stepFcnThief(action, loggedSignals)
persistent tc w r policeAgent warnedNoPolice
addr = '127.0.0.1';
port = 7777;

% (re)usar la misma conexión
if isempty(tc) || ~isvalid(tc)
    tc = tcpclient(addr, port, 'Timeout', 30);
    configureTerminator(tc,"LF");
    w  = @(s) writeline(tc, jsonencode(s));
    r  = @() jsondecode(char(readline(tc)));
end

% ---- Parseo de acción del ladrón (1x2) ----
if iscell(action), aT = double(action{1}(:)).';
else,               aT = double(action(:)).';
end

% ===== Estado previo =====
wallsRC  = loggedSignals.wallsRC;     % Nx2 [row col], 1-based
gridSize = loggedSignals.gridSize;    % escalar (G)
wallPenalty = 0;

% Estado previo (SIM units, 0-based continuas)
lastObsSim = loggedSignals.lastObs;   % [tx; ty; p0x; p0y; p1x; p1y]
tx_prev  = lastObsSim(1); ty_prev  = lastObsSim(2);
p0x_prev = lastObsSim(3); p0y_prev = lastObsSim(4);
p1x_prev = lastObsSim(5); p1y_prev = lastObsSim(6);

%% ===== Acción de los policías (agente entrenado o fijos) =====
aP0 = [0 0];  % por defecto, policías quietos
aP1 = [0 0];

try
    % Cargar agente de policía una sola vez (persistente)
    if isempty(policeAgent)
        [policeAgent, ~] = pickAgentWeighted('agents_police', 'agent_police');
    end

    if ~isempty(policeAgent)
        % Construir observación como en el entorno de Police:
        % [tx ty p0x p0y p1x p1y d0 d1] escalados
        Gsim = double(gridSize);

        d0_prev = hypot(p0x_prev - tx_prev, p0y_prev - ty_prev);
        d1_prev = hypot(p1x_prev - tx_prev, p1y_prev - ty_prev);
        d0_prev_s = d0_prev / (sqrt(2)*Gsim);
        d1_prev_s = d1_prev / (sqrt(2)*Gsim);

        tx_s_prev  = tx_prev  / Gsim;
        ty_s_prev  = ty_prev  / Gsim;
        p0x_s_prev = p0x_prev / Gsim;
        p0y_s_prev = p0y_prev / Gsim;
        p1x_s_prev = p1x_prev / Gsim;
        p1y_s_prev = p1y_prev / Gsim;

        obsPolice = [ ...
            tx_s_prev; ty_s_prev; ...
            p0x_s_prev; p0y_s_prev; ...
            p1x_s_prev; p1y_s_prev; ...
            d0_prev_s; d1_prev_s];

        % Pedir acción al agente de Police
        [aRaw, ~] = getAction(policeAgent, {obsPolice});

        if iscell(aRaw)
            aP = double(aRaw{1}(:)).';
        else
            aP = double(aRaw(:)).';
        end

        % aP debe ser 1x4: [dx0 dy0 dx1 dy1]
        if numel(aP) >= 4
            aP0 = aP(1,1:2);
            aP1 = aP(1,3:4);
        end
    end

catch ME
    % Si no hay modelos aún o cualquier fallo: policías fijos
    if isempty(warnedNoPolice) || ~warnedNoPolice
        warning('stepFcnPolice:NoPoliceAgent', ...
            'No se pudo usar agente de Police. Se usan policías fijos [0 0]. Detalle: %s', ...
            ME.message);
        warnedNoPolice = true;
    end
    aP0 = [0 0];
    aP1 = [0 0];
end



%% ===== Shaping: penalizar intento de entrar a MURO (para el ladrón) =====
% Destino INTENTADO por el ladrón (SIM units)
tqx_try = tx_prev + aT(1);
tqy_try = ty_prev + aT(2);

% Pasar a celdas 1-based y acotar a [1..G]
G = gridSize;
tq_cell = [ min(max(round(tqy_try)+1,1), G), min(max(round(tqx_try)+1,1), G) ];

if ~isempty(wallsRC)
    if ismember(tq_cell, wallsRC, 'rows')
        wallPenalty = wallPenalty - 0.05;
    end
end
% ===== fin shaping muros =====

% ---- Paso del simulador vía TCP ----
w(struct('cmd','step','aThief',aT,'aP0',aP0,'aP1',aP1,'n',12,'dt',0.02));
C = r();

% ---- Terminación y recompensa (ladrón) ----
tmax = 35;
done = logical(C.info.captured || C.info.t >= tmax);

% Base: +0.001 por paso vivo, -1 por captura, + wallPenalty
reward = double(~done)*0.001 - double(C.info.captured) + wallPenalty;

% ===== DISTANCIA: shaping por ALEJARSE de los policías =====
% Distancias previas (normalizadas por diag del grid)
d0_prev = hypot(p0x_prev - tx_prev, p0y_prev - ty_prev);
d1_prev = hypot(p1x_prev - tx_prev, p1y_prev - ty_prev);
d0_prev_s = d0_prev / (sqrt(2)*double(C.info.gridSize));
d1_prev_s = d1_prev / (sqrt(2)*double(C.info.gridSize));
d_prev_avg = 0.5*(d0_prev_s + d1_prev_s);

% Distancias actuales (SIM units)
tx = C.obs.thief(1); ty = C.obs.thief(2);
p0x = C.obs.p0(1);   p0y = C.obs.p0(2);
p1x = C.obs.p1(1);   p1y = C.obs.p1(2);

d0 = hypot(p0x - tx, p0y - ty);
d1 = hypot(p1x - tx, p1y - ty);

% Normalizadas
Gsim  = double(C.info.gridSize);
d0_s  = d0 / (sqrt(2)*Gsim);
d1_s  = d1 / (sqrt(2)*Gsim);
d_curr_avg = 0.5*(d0_s + d1_s);

% Para el ladrón: delta positivo si SE ALEJA
delta_avg = d_curr_avg - d_prev_avg;

% Peso y clip por paso
kDist = 0.25;                       % simétrico al de Police
delta_clipped = max(min(delta_avg, 0.2), -0.2);
reward = reward + kDist * delta_clipped;
% ===== fin DISTANCIA =====

% ===== Anti-stall: penaliza quedarse quieto =====
mT = hypot(tx - tx_prev, ty - ty_prev);
stall_eps = 1e-3;
stall_pen = 0.02;
if mT < stall_eps
    reward = reward - stall_pen;
end
% ===== fin Anti-stall =====

% Bonus por sobrevivir al timeout (si NO fue capturado)
if ~C.info.captured && C.info.t >= tmax
    rSurviveBonus = 1.5;  % simétrico a la penalización de Police por timeout
    reward = reward + rSurviveBonus;
end

% ---- Observación: posiciones ESCALADAS + d0_s, d1_s ----
tx_s  = tx  / Gsim; ty_s  = ty  / Gsim;
p0x_s = p0x / Gsim; p0y_s = p0y / Gsim;
p1x_s = p1x / Gsim; p1y_s = p1y / Gsim;

v   = [tx_s, ty_s, p0x_s, p0y_s, p1x_s, p1y_s, d0_s, d1_s];  % 1x8 escalado
obs = reshape(double(v), [8,1]);

% Guardar lastObs en SIM units (no escaladas) para el shaping del próximo step
loggedSignals.lastObs = reshape(double([tx, ty, p0x, p0y, p1x, p1y]), [6,1]);
end
