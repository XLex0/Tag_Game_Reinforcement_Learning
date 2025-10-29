function [obs, reward, done, loggedSignals] = stepFcnThief(action, loggedSignals)
persistent tc w r currentPort
basePort = 7777;

% --- puerto por worker ---
[~, port] = localWorkerPort(basePort);

% --- (re)crear conexión si no existe o cambió el puerto ---
if isempty(tc) || ~isvalid(tc) || isempty(currentPort) || currentPort ~= port
    try
        tc = tcpclient('127.0.0.1', port, 'Timeout', 30);
        configureTerminator(tc,"LF");
        w  = @(s) writeline(tc, jsonencode(s));
        r  = @() jsondecode(char(readline(tc)));
        currentPort = port;
    catch ME
        error("stepFcnThief:SocketError", "No se pudo conectar a %s:%d -> %s", ...
              '127.0.0.1', port, ME.message);
    end
end

% ---- Acción del ladrón (1x2) ----
if iscell(action)
    aT = double(action{1}(:)).';  % 1x2
else
    aT = double(action(:)).';     % 1x2
end

% (opcional) shaping con wallsRC/gridSize:
% wallsRC  = loggedSignals.wallsRC;
% gridSize = loggedSignals.gridSize;

w(struct('cmd','step','aThief',aT,'aP0',[0 0],'aP1',[0 0],'n',12,'dt',0.02));
C = r();

tmax  = 10;
done  = logical(C.info.captured || C.info.t >= tmax);
reward = double(~done)*0.001 - double(C.info.captured);

v = [C.obs.thief, C.obs.p0, C.obs.p1];   % 1x6
obs = reshape(double(v),[6,1]);          % 6x1
end
