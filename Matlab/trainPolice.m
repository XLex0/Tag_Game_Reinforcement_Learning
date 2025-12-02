%% ==== 0) Detectar si hay GPU disponible ====
useGPU = false;
try
    g = gpuDevice;                    % intenta usar la GPU por defecto
    fprintf('Usando GPU: %s\n', g.Name);
    useGPU = true;
catch ME
    % MessageID inventado: 'GPU:Fallback'
    warning('GPU:Fallback', ...
        'No se pudo usar GPU, se entrenará en CPU.\nDetalle: %s', ME.message);
    useGPU = false;
end

if useGPU
    deviceStr = "gpu";
else
    deviceStr = "cpu";
end

%% ==== 1) Crear entorno del equipo policía ====
envPolice = createEnvPolice();
obsInfoP = getObservationInfo(envPolice);
actInfoP = getActionInfo(envPolice);

if ~exist('agents_police','dir'), mkdir agents_police; end

%% ==== 2) Cargar agente previo si existe, si no crearlo ====
d = dir(fullfile('agents_police','agent_police_*.mat'));

if isempty(d)
    % ---------- NO hay modelos previos: usar tu config original ----------
    numObsP  = obsInfoP.Dimension(1);
    numActP  = numel(actInfoP.Elements);

    criticNetP = [
        featureInputLayer(numObsP,'Normalization','none','Name','state')
        fullyConnectedLayer(256)
        reluLayer
        fullyConnectedLayer(200)
        reluLayer
        fullyConnectedLayer(128)
        reluLayer
        fullyConnectedLayer(numActP,'Name','Qout')];

criticOpts = rlRepresentationOptions('UseDevice', deviceStr);
criticP = rlQValueRepresentation( ...
    criticNetP, ...
    obsInfoP, ...
    actInfoP, ...
    'Observation', {'state'}, ...
    criticOpts);

    agentOptsP = rlDQNAgentOptions;
    agentOptsP.UseDoubleDQN = true;
    agentOptsP.TargetUpdateFrequency = 1000;
    agentOptsP.ExperienceBufferLength = 2e5;
    agentOptsP.MiniBatchSize = 256;
    agentOptsP.DiscountFactor = 0.99;
    agentOptsP.EpsilonGreedyExploration.Epsilon      = 1.0;
    agentOptsP.EpsilonGreedyExploration.EpsilonMin   = 0.05;
    agentOptsP.EpsilonGreedyExploration.EpsilonDecay = 2e-4;

    agentPolice = rlDQNAgent(criticP, agentOptsP);
    fprintf('Police: no había modelos, creado agente nuevo.\n');

else
    % ---------- SÍ hay modelos: cargamos el ÚLTIMO ----------
    ids = zeros(1,numel(d));
    for k = 1:numel(d)
        t = regexp(d(k).name,'agent_police_(\d+)\.mat','tokens','once');
        ids(k) = str2double(t{1});
    end
    [~,imax] = max(ids);
    fnameLoad = fullfile('agents_police', d(imax).name);
    s = load(fnameLoad);
    agentPolice = s.agent;
    fprintf('Police: cargado modelo previo %s\n', fnameLoad);
end

%% ==== 3) Pool paralelo ====
if isempty(gcp('nocreate'))
    parpool("local", 6);
end

%% ==== 4) Opciones de paralelización ====
useParallel = true;

parOpts = rl.option.ParallelTraining;
parOpts.Mode                  = 'async';
parOpts.DataToSendFromWorkers = 'Experiences';
parOpts.StepsUntilDataIsSent  = 32;
parOpts.WorkerRandomSeeds     = -1;

trainOptsP = rlTrainingOptions( ...
    'MaxEpisodes', 1000, ...
    'MaxStepsPerEpisode', 70, ...
    'UseParallel', useParallel, ...
    'ParallelizationOptions', parOpts, ...
    'Verbose', true, ...
    'Plots', 'none', ...
    'StopTrainingCriteria','EpisodeCount', ...   % << fija por episodios
    'StopTrainingValue', 1000, ...              % igual que MaxEpisodes
    'SaveAgentCriteria','none', ...             % ya usamos saveAgentVersioned
    'SaveAgentDirectory','' ...
);


%% ==== 6) Entrenamiento ====
statsP = train(agentPolice, envPolice, trainOptsP); %#ok<NASGU>

%% ==== 7) Guardar versión nueva ====
fnamePolice = saveAgentVersioned(agentPolice, 'agents_police','agent_police');
fprintf('Police: guardado en %s\n', fnamePolice);
