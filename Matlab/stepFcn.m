function [obs, reward, done, loggedSignals] = stepFcn(action, loggedSignals)
persistent tc w r
if isempty(tc)
    tc = tcpclient('127.0.0.1',7777,'Timeout',30);
    configureTerminator(tc,"LF");
    w = @(s) writeline(tc,jsonencode(s));
    r = @() jsondecode(char(readline(tc)));
end

aT = reshape(double(action),[2,1]).';       % 1x2
w(struct('cmd','step','aThief',aT,'aP0',[0 0],'aP1',[0 0],'n',12,'dt',0.02));
C = r();

tmax  = 10;
done  = logical(C.info.captured || C.info.t >= tmax);
reward = double(~done)*0.001 - double(C.info.captured);

v = [C.obs.thief, C.obs.p0, C.obs.p1];      % 1x6
obs = reshape(double(v),[6,1]);             % 6x1 double
end
