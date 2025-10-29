function [obs, loggedSignals] = resetFcn()
persistent tc w r
seed = 2023014;
addr = '127.0.0.1';
port = 7777;                      % <- SIEMPRE el mismo puerto

tc = ensureConn(tc, addr, port, 30);
configureTerminator(tc,"LF");
w  = @(s) writeline(tc, jsonencode(s));
r  = @() jsondecode(char(readline(tc)));

% Reset del simulador
w(struct('cmd','reset','seed',seed));
C = r();

% ---------- Extraer posiciones (igual que antes) ----------
tx  = double(C.obs.thief(1)); ty  = double(C.obs.thief(2));
p0x = double(C.obs.p0(1));    p0y = double(C.obs.p0(2));
p1x = double(C.obs.p1(1));    p1y = double(C.obs.p1(2));
d0 = hypot(p0x - tx, p0y - ty);
d1 = hypot(p1x - tx, p1y - ty);

G   = double(C.info.gridSize);
txs  = tx  / G; tys  = ty  / G;
p0xs = p0x / G; p0ys = p0y / G;
p1xs = p1x / G; p1ys = p1y / G;
d0s  = d0  / (sqrt(2)*G);
d1s  = d1  / (sqrt(2)*G);

v   = [txs, tys, p0xs, p0ys, p1xs, p1ys, d0s, d1s];
obs = reshape(v, [8,1]);

if isstruct(C.info.wallsRC)
    rc = [[C.info.wallsRC.r].' [C.info.wallsRC.c].'];  % 0-based
    wallsRC = rc + 1;                                   % -> 1-based
elseif isnumeric(C.info.wallsRC)
    wallsRC = double(C.info.wallsRC);
else
    error('resetFcn:BadWalls','Formato wallsRC no reconocido');
end

loggedSignals = struct();
loggedSignals.wallsRC  = wallsRC;
loggedSignals.gridSize = G;
loggedSignals.lastObs  = reshape([tx, ty, p0x, p0y, p1x, p1y], [6,1]);
end

function tc = ensureConn(tc, addr, port, timeoutSec)
t0 = tic; backoff = 0.2;
while true
    try
        if isempty(tc) || ~isvalid(tc)
            tc = tcpclient(addr, port, "Timeout", 30);
            configureTerminator(tc,"LF");
        end
        % ping rápido para verificar socket vivo
        writeline(tc, '{"cmd":"context"}');
        jsondecode(char(readline(tc)));
        return
    catch
        if toc(t0) > timeoutSec
            error("resetFcn:Conn", ...
                "No se pudo conectar a %s:%d en %ds.", addr, port, timeoutSec);
        end
        pause(backoff);
        backoff = min(backoff*1.5, 2.0);
    end
end
end
