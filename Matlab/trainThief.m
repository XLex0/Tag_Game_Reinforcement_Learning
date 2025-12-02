% trainThief.m  -- script, NO función

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


%% ==== 1) Crear entorno del ladrón ====
envThief = createEnvThief();   % obs 8x1: [tx ty p0x p0y p1x p1y d0 d1]
obsInfoT = getObservationInfo(envThief);
actInfoT = getActionInfo(envThief);

if ~exist('agents_thief','dir'), mkdir agents_thief; end

%% ==== 2) Cargar agente previo si existe, si no crearlo ====
d = dir(fullfile('agents_thief','agent_thief_*.mat'));

if isempty(d)
    % ---------- NO hay modelos previos: usar tu config original ----------
    numObsT  = obsInfoT.Dimension(1);        % 8
    numActT  = numel(actInfoT.Elements);     % 9

    criticNetT = [
        featureInputLayer(numObsT,'Normalization','none','Name','state')
        fullyConnectedLayer(200)
        reluLayer
        fullyConnectedLayer(128)
        reluLayer
        fullyConnectedLayer(64)
        reluLayer
        fullyConnectedLayer(numActT,'Name','Qout')];
criticOpts = rlRepresentationOptions('UseDevice', deviceStr);
criticT = rlQValueRepresentation( ...
    criticNetT, ...
    obsInfoT, ...
    actInfoT, ...
    'Observation', {'state'}, ...
    criticOpts);

    agentOptsT = rlDQNAgentOptions;
    agentOptsT.UseDoubleDQN = true;
    agentOptsT.TargetUpdateFrequency = 1000;
    agentOptsT.ExperienceBufferLength = 1e5;
    agentOptsT.MiniBatchSize = 256;
    agentOptsT.DiscountFactor = 0.99;
    agentOptsT.EpsilonGreedyExploration.Epsilon      = 1.0;
    agentOptsT.EpsilonGreedyExploration.EpsilonMin   = 0.05;
    agentOptsT.EpsilonGreedyExploration.EpsilonDecay = 2e-4;

    agentThief = rlDQNAgent(criticT, agentOptsT);
    fprintf('Thief: no había modelos, creado agente nuevo.\n');

else
    % ---------- SÍ hay modelos: cargamos el ÚLTIMO ----------
    ids = zeros(1,numel(d));
    for k = 1:numel(d)
        t = regexp(d(k).name,'agent_thief_(\d+)\.mat','tokens','once');
        ids(k) = str2double(t{1});
    end
    [~,imax] = max(ids);
    fnameLoad = fullfile('agents_thief', d(imax).name);
    s = load(fnameLoad);
    if isfield(s,'agent')
        agentThief = s.agent;
    else
        fns = fieldnames(s);
        agentThief = s.(fns{1});
    end
    fprintf('Thief: cargado modelo previo %s\n', fnameLoad);
end

%% ==== 3) Pool paralelo ====
if isempty(gcp('nocreate'))
    parpool("local", 3);   % por ejemplo 3 workers
end

%% ==== 4) Opciones de paralelización ====
useParallel = true;

parOpts = rl.option.ParallelTraining;
parOpts.Mode                  = 'async';
parOpts.DataToSendFromWorkers = 'Experiences';
parOpts.StepsUntilDataIsSent  = 32;
parOpts.WorkerRandomSeeds     = -1;

%% ==== 5) Opciones de entrenamiento (AQUÍ se define SIEMPRE trainOptsT) ====
trainOptsT = rlTrainingOptions( ...
    'MaxEpisodes', 10, ...
    'MaxStepsPerEpisode', 70, ...
    'UseParallel', useParallel, ...
    'ParallelizationOptions', parOpts, ...
    'Verbose', true, ...
    'Plots', 'none', ...
    'StopTrainingCriteria','EpisodeCount', ...
    'StopTrainingValue', 10, ...
    'SaveAgentCriteria','none', ...
    'SaveAgentDirectory','' ...
);

%% ==== 6) Entrenamiento ====
statsT = train(agentThief, envThief, trainOptsT); %#ok<NASGU>

%% ==== 7) Guardar versión nueva ====
fnameThief = saveAgentVersioned(agentThief, 'agents_thief', 'agent_thief');
fprintf('Thief: guardado en %s\n', fnameThief);
