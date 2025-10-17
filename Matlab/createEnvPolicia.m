function env = createEnvPolice()
  obsInfo = rlNumericSpec([6 1],'Name','state');
  actInfo = rlNumericSpec([4 1],'LowerLimit',-1,'UpperLimit',1,'Name','aPolice');
  env = rlFunctionEnv(obsInfo, actInfo, @stepFcnPolice, @resetFcnPolice);
  validateEnvironment(env);
end
