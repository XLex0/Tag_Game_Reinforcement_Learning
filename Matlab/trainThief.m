env = createEnv();
obsInfo = getObservationInfo(env);
actInfo = getActionInfo(env);
agent = agentThief(obsInfo, actInfo);

opts = rlTrainingOptions("MaxEpisodes",300,"MaxStepsPerEpisode",1500, ...
    "ScoreAveragingWindowLength",50,"Verbose",true);
stats = train(agent, env, opts);
save agentThief.mat agent
