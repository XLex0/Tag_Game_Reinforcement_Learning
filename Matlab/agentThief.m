function agent = agentThief(obsInfo, actInfo)
% ----- Actor con 2 cabezas: mean y std -----
lgA = layerGraph();
lgA = addLayers(lgA, featureInputLayer(6,"Normalization","none","Name","obs"));
lgA = addLayers(lgA, fullyConnectedLayer(32,"Name","fc1"));
lgA = addLayers(lgA, reluLayer("Name","relu1"));
lgA = addLayers(lgA, fullyConnectedLayer(16,"Name","fc2"));
lgA = addLayers(lgA, reluLayer("Name","relu2"));

% Cabeza mean (tanh para [-1,1])
lgA = addLayers(lgA, fullyConnectedLayer(2,"Name","mu_fc"));
lgA = addLayers(lgA, tanhLayer("Name","mu_out"));

% Cabeza std (positiva con softplus)
lgA = addLayers(lgA, fullyConnectedLayer(2,"Name","std_fc"));
lgA = addLayers(lgA, softplusLayer("Name","std_out"));

% Conexiones tronco
lgA = connectLayers(lgA,"obs","fc1");
lgA = connectLayers(lgA,"fc1","relu1");
lgA = connectLayers(lgA,"relu1","fc2");
lgA = connectLayers(lgA,"fc2","relu2");

% Ramas
lgA = connectLayers(lgA,"relu2","mu_fc");
lgA = connectLayers(lgA,"mu_fc","mu_out");

lgA = connectLayers(lgA,"relu2","std_fc");
lgA = connectLayers(lgA,"std_fc","std_out");

actor = rlContinuousGaussianActor(lgA, obsInfo, actInfo, ...
    "ActionMeanOutputNames","mu_out", ...
    "ActionStandardDeviationOutputNames","std_out");

% ----- Crítico -----
lgC = layerGraph();
lgC = addLayers(lgC, featureInputLayer(6,"Normalization","none","Name","obs"));
lgC = addLayers(lgC, fullyConnectedLayer(32,"Name","cfc1"));
lgC = addLayers(lgC, reluLayer("Name","crelu1"));
lgC = addLayers(lgC, fullyConnectedLayer(32,"Name","cfc2"));
lgC = addLayers(lgC, reluLayer("Name","crelu2"));
lgC = addLayers(lgC, fullyConnectedLayer(1,"Name","V"));

lgC = connectLayers(lgC,"obs","cfc1");
lgC = connectLayers(lgC,"cfc1","crelu1");
lgC = connectLayers(lgC,"crelu1","cfc2");
lgC = connectLayers(lgC,"cfc2","crelu2");
lgC = connectLayers(lgC,"crelu2","V");

critic = rlValueFunction(lgC, obsInfo);

% ----- PPO -----
actorOpts  = rlOptimizerOptions("LearnRate",3e-4,"GradientThreshold",1);
criticOpts = rlOptimizerOptions("LearnRate",3e-4,"GradientThreshold",1);
agentOpts  = rlPPOAgentOptions( ...
    "ExperienceHorizon",256,"MiniBatchSize",256, ...
    "ClipFactor",0.2,"EntropyLossWeight",1e-3,"DiscountFactor",0.99, ...
    "ActorOptimizerOptions",actorOpts,"CriticOptimizerOptions",criticOpts);

agent = rlPPOAgent(actor, critic, agentOpts);
end
