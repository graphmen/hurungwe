library(randomForest)
library(dismo)
library(raster)
library(ggplot2)
library(dplyr)

# 1. Setup
cat("Loading data for final line graph generation...\n")
retained_vars <- readLines("retained_vars.txt")
# Point to original rasters to avoid massive copy operations
raster_files <- file.path("../Bioclims/prepared_rasters", paste0(retained_vars, ".tif"))
env_stack <- raster::stack(raster_files)
species_df <- read.csv("species_prepared.csv")

dir.create("sdm_outputs/graphs/response", recursive = TRUE, showWarnings = FALSE)

# 2. Metric Trends (Reuse existing logic)
cat("Updating metric comparison plot...\n")
if (file.exists("tidy_evaluations.csv")) {
  eval_data <- read.csv("tidy_evaluations.csv")
  # Filter for core performance metrics
  plot_data <- eval_data %>% 
    filter(metric %in% c("AUC", "Kappa", "sensitivity", "specificity"))
  
  # Calculate TSS = Sensitivity + Specificity - 1
  tss_data <- eval_data %>%
    filter(metric %in% c("sensitivity", "specificity")) %>%
    tidyr::pivot_wider(names_from = metric, values_from = value) %>%
    mutate(value = sensitivity + specificity - 1, metric = "TSS") %>%
    select(species, metric, value)
    
  plot_combined <- rbind(plot_data, tss_data)
  
  p_metrics <- ggplot(plot_combined, aes(x = species, y = value, color = metric, group = metric)) +
    geom_line(linewidth = 1.2, alpha = 0.8) + 
    geom_point(size = 3.5) +
    theme_minimal() + 
    theme(axis.text.x = element_text(angle = 45, hjust = 1, face = "bold"),
          panel.grid.minor = element_blank()) +
    scale_color_manual(values = c(
      "AUC" = "#2c7bb6", 
      "Kappa" = "#d7191c",
      "TSS" = "#1a9641",
      "sensitivity" = "#fdae61",
      "specificity" = "#a6d96a"
    )) +
    labs(title = "Comprehensive Model Performance Trends",
         subtitle = "AUC, Kappa, TSS, Sensitivity & Specificity across 10 species",
         x = "Tree Species", y = "Metric Score (0-1)")
  
  ggsave("sdm_outputs/graphs/metrics_line.png", p_metrics, width = 12, height = 7)
}

# 3. Response Curves (The robust way)
unique_species <- unique(species_df$species)
unique_species <- unique_species[tolower(unique_species) != "none" & unique_species != ""]

# Generate background points (once, to save time)
cat("Generating background points for response curves...\n")
bg <- sampleRandom(env_stack, size = 1000, na.rm = TRUE, sp = TRUE)
bg_vals <- as.data.frame(extract(env_stack, bg))
bg_vals$presence <- 0

for (sp in unique_species) {
  cat("\n--- Analyzing Response Relationships for:", sp, "---\n")
  sp_safe <- gsub("[^[:alnum:]]", "_", sp)
  
  # Load importance to find top 3
  imp_file <- file.path("sdm_outputs/importance", paste0(sp_safe, "_importance.csv"))
  if (!file.exists(imp_file)) next
  imp <- read.csv(imp_file)
  top_vars <- names(imp)[order(unlist(imp), decreasing = TRUE)][1:3]
  
  # Presence data
  sp_data <- species_df[species_df$species == sp, c("lon", "lat")]
  pres_vals <- as.data.frame(extract(env_stack, sp_data))
  pres_vals$presence <- 1
  
  # Combine
  train_df <- rbind(pres_vals, bg_vals)
  train_df <- na.omit(train_df)
  
  # Train simple RF for shape extraction
  set.seed(42)
  model_rf <- randomForest(as.factor(presence) ~ ., data = train_df, ntree = 50)
  
  # Plot curves
  for (var in top_vars) {
    cat("Exporting line graph for", var, "...\n")
    png(file.path("sdm_outputs/graphs/response", paste0(sp_safe, "_", var, ".png")), width = 600, height = 400)
    # We use type='prob' (second column for presence)
    # dismo::response handles RF objects gracefully
    tryCatch({
      dismo::response(model_rf, var = var, main = paste(sp, "-", var), 
                      xlab = var, ylab = "Suitability Probability")
    }, error = function(e) {
      plot(1, 1, main = paste("Error plotting", var))
    })
    dev.off()
  }
}

cat("\nAll line graphs successfully generated in sdm_outputs/graphs/\n")
