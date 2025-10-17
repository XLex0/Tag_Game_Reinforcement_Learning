function [obs, loggedSignals] = resetFcn()
persistent tc w r
if isempty(tc)
    tc = tcpclient('127.0.0.1',7777,'Timeout',30);
    configureTerminator(tc,"LF");
    w = @(s) writeline(tc,jsonencode(s));
    r = @() jsondecode(char(readline(tc)));
end
w(struct('cmd','reset','seed',randi(1e6)));
C = r();

v = [C.obs.thief, C.obs.p0, C.obs.p1];     % 1x6
obs = reshape(double(v),[6,1]);            % 6x1 double
loggedSignals = struct();                   % requerido por la firma
end
