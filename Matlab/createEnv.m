function env = createEnv()
    obsInfo = rlNumericSpec([6 1],'Name','state');
    actInfo = rlNumericSpec([2 1],'LowerLimit',-1,'UpperLimit',1,'Name','aThief');
    env = rlFunctionEnv(obsInfo, actInfo, @stepFcn, @resetFcn);
    validateEnvironment(env);
end
