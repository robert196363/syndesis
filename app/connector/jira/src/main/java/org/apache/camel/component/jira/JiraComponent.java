/*
 * Copyright (C) 2016 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.camel.component.jira;

import java.util.Map;

import org.apache.camel.CamelContext;
import org.apache.camel.Endpoint;
import org.apache.camel.impl.DefaultComponent;
import org.apache.camel.spi.Metadata;

/**
 * Represents the component that manages {@link JiraEndpoint}.
 */
public class JiraComponent extends DefaultComponent {

    @Metadata(label = "advanced")
    private JiraConfiguration configuration;

    public JiraComponent() {
        this(null);
    }

    public JiraComponent(CamelContext context) {
        super(context);
        configuration = new JiraConfiguration();
        registerExtension(new JiraVerifierExtension());
    }

    @Override
    protected Endpoint createEndpoint(String uri, String remaining, Map<String, Object> parameters) throws Exception {
        // override configuration from route parameters
        setProperties(configuration, parameters);

        JiraEndpoint endpoint = new JiraEndpoint(uri, this, configuration);
        endpoint.setType(getCamelContext().getTypeConverter().convertTo(JiraType.class, remaining));
        return endpoint;
    }

    /**
     * The JiraConfiguration parameters
     */
    public JiraConfiguration getConfiguration() {
        return configuration;
    }

    public void setConfiguration(JiraConfiguration configuration) {
        this.configuration = configuration;
    }

}
